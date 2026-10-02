/**
 * Registre, par album, des photos de l'album présentes sur ce téléphone :
 * celles que l'utilisateur a envoyées depuis sa galerie, et celles qu'il a téléchargées.
 * Sert à ne pas enregistrer de doublon. Stockage local SQLite via expo-sqlite/kv-store.
 */
import Storage from 'expo-sqlite/kv-store';

import { getCurrentUserId } from '@/services/auth-api';

/** photoId de l'album → id de l'asset dans la galerie du téléphone. */
export type DevicePhotoMap = Record<string, string>;

function storageKey(albumId: string) {
  // Préfixé par l'utilisateur : deux comptes sur le même téléphone ne se mélangent pas.
  return `device-photos:${getCurrentUserId()}:${albumId}`;
}

export function getDevicePhotos(albumId: string): DevicePhotoMap {
  try {
    const raw = Storage.getItemSync(storageKey(albumId));
    return raw ? (JSON.parse(raw) as DevicePhotoMap) : {};
  } catch {
    return {};
  }
}

function setDevicePhotos(albumId: string, map: DevicePhotoMap): void {
  Storage.setItemSync(storageKey(albumId), JSON.stringify(map));
}

export function markPhotoOnDevice(albumId: string, photoId: string, assetId: string): void {
  const map = getDevicePhotos(albumId);
  map[photoId] = assetId;
  setDevicePhotos(albumId, map);
}
