/**
 * File d'envoi des photos, en arrière-plan de la navigation.
 *
 * Swiper va plus vite qu'envoyer : chaque photo acceptée entre ici et l'écran passe à la
 * suivante. La file envoie deux photos à la fois, survit à un redémarrage (persistée par
 * compte), attend le réseau quand il manque, réessaie les échecs passagers avec des délais
 * croissants, et garde les échecs définitifs pour que l'utilisateur réessaie ou abandonne.
 * Le nombre de photos parties reste affiché tant qu'on n'a pas quitté l'album.
 *
 * Vit hors de React : un module, un seul état, des abonnés (`subscribe`) pour l'affichage.
 */
import { onlineManager } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import { albumApi } from '@/services/album-api';
import { ApiError } from '@/services/api-client';
import { markPhotoOnDevice } from '@/services/device-photos-store';
import { DuplicatePhotoError } from '@/services/photo-upload';
import { removeReview } from '@/services/review-store';
import type { GalleryPhoto } from '@/types/album';

/** Envois simultanés : la préparation des images est lourde, deux suffisent à saturer le réseau. */
const MAX_PARALLEL = 2;
/** Délais avant une nouvelle tentative automatique ; au-delà, l'échec attend l'utilisateur. */
const RETRY_DELAYS_MS = [3_000, 10_000, 30_000];

export type UploadItem = {
  albumId: string;
  photo: GalleryPhoto;
  status: 'pending' | 'uploading' | 'failed';
  attempts: number;
  /** Prochain essai au plus tôt (échec passager) ; absent : dès que possible. */
  retryAt?: number;
  /** Pourquoi l'envoi a échoué, pour l'afficher. */
  error?: string;
};

/** Ce qu'un écran affiche pour un album : en cours, envoyées depuis le dernier calme, échecs. */
export type AlbumUploads = {
  active: number;
  done: number;
  failed: number;
  /** Première raison d'échec, pour l'afficher. */
  error: string | null;
};

const IDLE: AlbumUploads = { active: 0, done: 0, failed: 0, error: null };

let userId: string | null = null;
let items: UploadItem[] = [];
/** Photos parties depuis la dernière visite de l'album : pour « 3 / 12 » puis « 12 envoyées ». */
const completed = new Map<string, number>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
/** Incrémenté à chaque arrêt : un envoi lancé avant n'écrit plus rien. */
let generation = 0;
let version = 0;

const listeners = new Set<() => void>();
const uploadedListeners = new Set<(albumId: string) => void>();
const snapshots = new Map<string, { version: number; stats: AlbumUploads }>();

function key(photo: GalleryPhoto, albumId: string) {
  return `${albumId}\n${photo.id}`;
}

function storageKey() {
  return `upload-queue:${userId}`;
}

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function persist() {
  if (!userId) return;
  try {
    // Un envoi interrompu par la fermeture de l'app repart de zéro au prochain lancement.
    const saved = items.map((item) =>
      item.status === 'uploading' ? { ...item, status: 'pending' as const } : item
    );
    Storage.setItemSync(storageKey(), JSON.stringify(saved));
  } catch {
    // Au pire, la file ne survit pas au redémarrage.
  }
}

function changed() {
  persist();
  emit();
  pump();
}

/** Démarre la file du compte connecté : recharge ce qui attendait et reprend les envois. */
export function startUploadQueue(id: string): void {
  if (userId === id) return;
  stopUploadQueue();
  userId = id;
  try {
    const raw = Storage.getItemSync(storageKey());
    items = raw ? (JSON.parse(raw) as UploadItem[]) : [];
  } catch {
    items = [];
  }
  emit();
  pump();
}

/** Déconnexion : la file reste sauvegardée pour ce compte, plus rien ne part. */
export function stopUploadQueue(): void {
  generation += 1;
  userId = null;
  items = [];
  completed.clear();
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  emit();
}

/** Ajoute des photos à envoyer dans l'album ; celles déjà en file sont ignorées. */
export function enqueueUploads(albumId: string, photos: GalleryPhoto[]): number {
  if (!userId) return 0;
  const present = new Set(items.map((item) => key(item.photo, albumId)));
  const fresh = photos.filter((photo) => !present.has(key(photo, albumId)));
  for (const photo of fresh) {
    items.push({ albumId, photo, status: 'pending', attempts: 0 });
  }
  if (fresh.length > 0) changed();
  return fresh.length;
}

/** Relance les envois en échec de l'album. */
export function retryFailedUploads(albumId: string): void {
  let touched = false;
  for (const item of items) {
    if (item.albumId === albumId && item.status === 'failed') {
      item.status = 'pending';
      item.attempts = 0;
      delete item.retryAt;
      delete item.error;
      touched = true;
    }
  }
  if (touched) changed();
}

/** Abandonne les envois en échec : les photos seront de nouveau proposées au tri. */
export function dismissFailedUploads(albumId: string): void {
  const failed = items.filter((item) => item.albumId === albumId && item.status === 'failed');
  if (failed.length === 0) return;
  for (const item of failed) removeReview(albumId, item.photo.id);
  items = items.filter((item) => !failed.includes(item));
  if (!hasWork(albumId)) completed.delete(albumId);
  changed();
}

/**
 * On quitte l'écran de l'album : le compte des photos parties repart de zéro. Pas pendant un
 * envoi, pour que « 3 / 12 » reste juste si on revient avant la fin.
 */
export function acknowledgeUploads(albumId: string): void {
  if (hasWork(albumId) || !completed.has(albumId)) return;
  completed.delete(albumId);
  emit();
}

/** Album supprimé ou quitté : plus rien à y envoyer. */
export function removeAlbumUploads(albumId: string): void {
  if (!items.some((item) => item.albumId === albumId)) return;
  items = items.filter((item) => item.albumId !== albumId);
  completed.delete(albumId);
  changed();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Prévenu à chaque photo arrivée dans un album : de quoi rafraîchir les écrans. */
export function subscribeUploaded(listener: (albumId: string) => void): () => void {
  uploadedListeners.add(listener);
  return () => {
    uploadedListeners.delete(listener);
  };
}

/** Instantané stable par album (même objet tant que rien n'a changé), pour React. */
export function getAlbumUploads(albumId: string): AlbumUploads {
  const cached = snapshots.get(albumId);
  if (cached && cached.version === version) return cached.stats;
  let active = 0;
  let failed = 0;
  let error: string | null = null;
  for (const item of items) {
    if (item.albumId !== albumId) continue;
    if (item.status === 'failed') {
      failed += 1;
      error ??= item.error ?? null;
    } else active += 1;
  }
  const done = completed.get(albumId) ?? 0;
  const stats = active === 0 && failed === 0 && done === 0 ? IDLE : { active, done, failed, error };
  snapshots.set(albumId, { version, stats });
  return stats;
}

/** Nombre total de photos en attente ou en cours, tous albums confondus. */
export function getActiveUploadCount(): number {
  return items.filter((item) => item.status !== 'failed').length;
}

function hasWork(albumId: string) {
  return items.some((item) => item.albumId === albumId && item.status !== 'failed');
}

function pump() {
  if (!userId || !onlineManager.isOnline()) return;
  const now = Date.now();
  let running = items.filter((item) => item.status === 'uploading').length;
  let nextRetry = Infinity;
  for (const item of items) {
    if (running >= MAX_PARALLEL) break;
    if (item.status !== 'pending') continue;
    if (item.retryAt && item.retryAt > now) {
      nextRetry = Math.min(nextRetry, item.retryAt);
      continue;
    }
    running += 1;
    void run(item, generation);
  }
  // Un échec passager attend son heure : on se réveille pile à ce moment-là.
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = nextRetry < Infinity ? setTimeout(pump, nextRetry - now + 50) : null;
}

async function run(item: UploadItem, gen: number) {
  item.status = 'uploading';
  delete item.retryAt;
  emit();
  try {
    const uploaded = await albumApi.uploadPhoto(item.albumId, item.photo);
    if (gen !== generation) return;
    // Cette photo vient de la galerie de ce téléphone : ne jamais la retélécharger.
    markPhotoOnDevice(item.albumId, uploaded.id, item.photo.id);
    finish(item);
  } catch (error) {
    if (gen !== generation) return;
    // Déjà dans l'album (envoyée par quelqu'un d'autre, ou depuis un autre téléphone).
    if (error instanceof DuplicatePhotoError) return finish(item);
    fail(item, error);
  }
}

function finish(item: UploadItem) {
  items = items.filter((other) => other !== item);
  completed.set(item.albumId, (completed.get(item.albumId) ?? 0) + 1);
  uploadedListeners.forEach((listener) => listener(item.albumId));
  changed();
}

function fail(item: UploadItem, error: unknown) {
  if (error instanceof ApiError && error.status === 404) {
    // Album supprimé, ou on n'en fait plus partie : plus rien à envoyer.
    items = items.filter((other) => other !== item);
  } else if (error instanceof ApiError && !error.transient) {
    item.status = 'failed';
    item.error =
      error.code === 'quota_reached'
        ? "L'album est plein : le propriétaire a atteint la limite de son offre."
        : error.message;
  } else if (!onlineManager.isOnline()) {
    // Le réseau a lâché en route : ce n'est pas une tentative, on reprendra avec lui.
    item.status = 'pending';
  } else if (item.attempts + 1 >= RETRY_DELAYS_MS.length + 1) {
    item.status = 'failed';
    item.error = "Impossible d'envoyer cette photo pour le moment.";
  } else {
    item.attempts += 1;
    item.status = 'pending';
    item.retryAt = Date.now() + RETRY_DELAYS_MS[item.attempts - 1];
  }
  changed();
}

// Le réseau revient, ou l'app repasse au premier plan : on reprend là où on en était.
onlineManager.subscribe((online) => {
  if (online) pump();
});
AppState.addEventListener('change', (state) => {
  if (state === 'active') pump();
});
