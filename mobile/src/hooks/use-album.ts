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
  const status: Status =
    albumQuery.isError || photosQuery.isError
      ? 'error'
      : albumQuery.isPending || photosQuery.isPending
        ? 'loading'
        : album
          ? 'ready'
          : 'not-found';

  return { album, photos: photosQuery.data ?? [], status, refreshing, refresh };
}
