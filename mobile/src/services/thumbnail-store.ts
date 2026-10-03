/**
 * Miniatures conservées sur le téléphone, pour afficher la grille d'un album hors ligne.
 *
 * Contrairement au cache d'expo-image, que le système peut vider, ces fichiers vivent dans les
 * documents de l'app : `media/<compte>/<album>/<photo>.jpg`. Ils arrivent de deux façons :
 * - à l'envoi : la miniature préparée par le téléphone est gardée, rien à télécharger ;
 * - à l'affichage : une miniature chargée depuis le bucket est recopiée depuis le cache
 *   d'expo-image (pas de second téléchargement).
 * Ils disparaissent quand la photo ou l'album n'est plus dans la liste renvoyée par l'API.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

import { getCurrentUserId } from '@/services/auth-api';

function rootDir(): Directory {
  return new Directory(Paths.document, 'media', getCurrentUserId());
}

function albumDir(albumId: string): Directory {
  return new Directory(rootDir(), albumId);
}

function thumbFile(albumId: string, photoId: string): File {
  return new File(albumDir(albumId), `${photoId}.jpg`);
}

function ensureDir(dir: Directory) {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

/** URI locale de la miniature si elle est déjà sur le téléphone. Synchrone : appel au rendu. */
export function localThumbUri(albumId: string, photoId: string): string | null {
  try {
    const file = thumbFile(albumId, photoId);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** Garde la miniature préparée pour l'envoi : la photo est à nous, inutile de la retélécharger. */
export async function keepUploadedThumb(albumId: string, photoId: string, sourceUri: string) {
  try {
    ensureDir(albumDir(albumId));
    await new File(sourceUri).copy(thumbFile(albumId, photoId));
  } catch {
    // Facultatif : au pire, la miniature sera reprise depuis le bucket.
  }
}

const saving = new Set<string>();

/**
 * Recopie dans le stockage une miniature qu'expo-image vient d'afficher depuis le bucket.
 * Le fichier est pris dans son cache disque, sans nouveau téléchargement.
 */
export async function keepDisplayedThumb(albumId: string, photoId: string, cacheKey: string) {
  const id = `${albumId}/${photoId}`;
  if (saving.has(id) || localThumbUri(albumId, photoId)) return;
  saving.add(id);
  try {
    const cached = await Image.getCachePathAsync(cacheKey);
    if (!cached) return;
    ensureDir(albumDir(albumId));
    const source = new File(cached.startsWith('file://') ? cached : `file://${cached}`);
    await source.copy(thumbFile(albumId, photoId));
  } catch {
    // On réessaiera au prochain affichage.
  } finally {
    saving.delete(id);
  }
}

/** Retire les miniatures des photos qui ne sont plus dans l'album. */
export function pruneAlbumThumbs(albumId: string, photoIds: string[]) {
  try {
    const dir = albumDir(albumId);
    if (!dir.exists) return;
    const keep = new Set(photoIds.map((id) => `${id}.jpg`));
    for (const entry of dir.list()) {
      if (entry instanceof File && !keep.has(entry.name)) entry.delete();
    }
  } catch {
    // Le ménage se refera au prochain chargement.
  }
}

/** Retire les dossiers des albums supprimés ou quittés. */
export function pruneAlbums(albumIds: string[]) {
  try {
    const root = rootDir();
    if (!root.exists) return;
    const keep = new Set(albumIds);
    for (const entry of root.list()) {
      if (entry instanceof Directory && !keep.has(entry.name)) entry.delete();
    }
  } catch {
    // Idem.
  }
}

/** Espace occupé par les miniatures de ce compte, en octets. */
export function thumbsSize(): number {
  try {
    const root = rootDir();
    return root.exists ? (root.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

/** Efface toutes les miniatures de ce compte (« Libérer de l'espace »). */
export function clearThumbs() {
  try {
    const root = rootDir();
    if (root.exists) root.delete();
  } catch {
    // Rien de grave : le prochain affichage recréera ce qu'il faut.
  }
}
