/**
 * Enregistre dans la galerie du téléphone des photos de l'album, et sait lesquelles
 * y sont déjà d'après le registre local.
 */
import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

import { getDevicePhotos, markPhotoOnDevice } from '@/services/device-photos-store';
import type { AlbumPhoto } from '@/types/album';

export type DownloadProgress = { done: number; total: number };
export type DownloadResult = { saved: number; failed: number };

export class PhotoPermissionError extends Error {
  constructor() {
    super("Autorisation d'accéder aux photos refusée.");
    this.name = 'PhotoPermissionError';
  }
}

async function ensurePermission(): Promise<void> {
  // Même accès complet que l'écran de tri : un seul prompt pour l'utilisateur.
  const permission = await requestPermissionsAsync(false, ['photo']);
  if (!permission.granted) throw new PhotoPermissionError();
}

/**
 * Les photos de l'album déjà présentes sur ce téléphone d'après le registre : celles
 * envoyées depuis cet appareil et celles déjà téléchargées. On ne vérifie pas que l'asset
 * existe encore : si l'utilisateur l'a supprimé de sa galerie, c'est qu'il n'en veut pas.
 * Il pourra toujours la cocher à la main pour la retélécharger.
 */
export function getPhotosOnDevice(albumId: string, photos: AlbumPhoto[]): Set<string> {
  const registry = getDevicePhotos(albumId);
  const onDevice = new Set<string>();
  for (const photo of photos) {
    if (registry[photo.id]) onDevice.add(photo.id);
  }
  return onDevice;
}

/** Extension de l'originale d'après son URL (`…/original.heic?X-Amz-…`). */
function extensionOf(url: string): string {
  return /\.([a-z0-9]+)(?:\?|$)/i.exec(url)?.[1] ?? 'jpg';
}

async function saveRemotePhoto(photo: AlbumPhoto): Promise<string> {
  // L'originale, dans son format (HEIC compris) : c'est elle qu'on veut dans la galerie.
  const file = new File(Paths.cache, `synkup-${photo.id}.${extensionOf(photo.originalUri)}`);
  try {
    if (file.exists) file.delete();
    const downloaded = await File.downloadFileAsync(photo.originalUri, file);
    const asset = await Asset.create(downloaded.uri);
    return asset.id;
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      // Le cache sera nettoyé par le système.
    }
  }
}

/** Télécharge et enregistre exactement les photos données, une par une. */
export async function downloadPhotos(
  albumId: string,
  photos: AlbumPhoto[],
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
  const result: DownloadResult = { saved: 0, failed: 0 };
  if (photos.length === 0) return result;
  await ensurePermission();

  onProgress?.({ done: 0, total: photos.length });
  for (const photo of photos) {
    try {
      const assetId = await saveRemotePhoto(photo);
      markPhotoOnDevice(albumId, photo.id, assetId);
      result.saved += 1;
    } catch {
      result.failed += 1;
    }
    onProgress?.({ done: result.saved + result.failed, total: photos.length });
  }
  return result;
}
