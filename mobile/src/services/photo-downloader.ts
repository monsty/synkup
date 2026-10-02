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

/** Une URI qui pointe déjà dans la galerie du téléphone (photo envoyée depuis cet appareil). */
function isLocalGalleryUri(uri: string): boolean {
  return uri.startsWith('ph://') || uri.startsWith('content://') || uri.startsWith('file://');
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
    if (registry[photo.id] || isLocalGalleryUri(photo.uri)) onDevice.add(photo.id);
  }
  return onDevice;
}

async function saveRemotePhoto(photo: AlbumPhoto): Promise<string> {
  const file = new File(Paths.cache, `synkup-${photo.id}.jpg`);
  try {
    if (file.exists) file.delete();
    const downloaded = await File.downloadFileAsync(photo.uri, file);
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
