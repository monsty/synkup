import { useCallback } from 'react';

import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { useAlbumPhotosQuery, useAlbumQuery } from '@/queries/albums';

type Status = 'loading' | 'ready' | 'error' | 'not-found';

/** Un album et ses photos ; se met à jour après un envoi ou une modification. */
export function useAlbum(albumId: string) {
  const albumQuery = useAlbumQuery(albumId);
  const photosQuery = useAlbumPhotosQuery(albumId);

  const { refetch: refetchAlbum } = albumQuery;
  const { refetch: refetchPhotos } = photosQuery;
  const refetch = useCallback(
    () => Promise.all([refetchAlbum(), refetchPhotos()]),
    [refetchAlbum, refetchPhotos]
  );
  const { refreshing, refresh } = useManualRefresh(refetch);

  const album = albumQuery.data ?? null;
  // Des données en cache (même anciennes) valent mieux qu'un écran d'erreur hors ligne.
  const status: Status =
    albumQuery.data !== undefined && photosQuery.data !== undefined
      ? album
        ? 'ready'
        : 'not-found'
      : albumQuery.isError || photosQuery.isError
        ? 'error'
        : 'loading';

  return { album, photos: photosQuery.data ?? [], status, refreshing, refresh };
}
