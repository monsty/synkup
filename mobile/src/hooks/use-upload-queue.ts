import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { albumKeys } from '@/queries/albums';
import {
  getActiveUploadCount,
  getAlbumUploads,
  startUploadQueue,
  stopUploadQueue,
  subscribe,
  subscribeUploaded,
} from '@/services/upload-queue';

/**
 * Relie la file d'envoi au reste de l'app, une fois à la racine : elle démarre et s'arrête
 * avec le compte connecté, et chaque photo arrivée rafraîchit l'album concerné.
 */
export function useUploadQueueSync() {
  const { user } = useAuth();
  const client = useQueryClient();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    startUploadQueue(userId);
    return () => stopUploadQueue();
  }, [userId]);

  useEffect(
    () =>
      subscribeUploaded((albumId) => {
        void client.invalidateQueries({ queryKey: albumKeys.photos(albumId) });
        void client.invalidateQueries({ queryKey: albumKeys.detail(albumId) });
        void client.invalidateQueries({ queryKey: albumKeys.list() });
      }),
    [client]
  );
}

/** Envois d'un album : en cours, parties, en échec. Se met à jour en direct. */
export function useAlbumUploads(albumId: string) {
  return useSyncExternalStore(subscribe, () => getAlbumUploads(albumId));
}

/** Photos en attente ou en cours d'envoi, tous albums confondus. */
export function useActiveUploadCount() {
  return useSyncExternalStore(subscribe, getActiveUploadCount);
}
