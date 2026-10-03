import { useCallback, useEffect, useState } from 'react';

import { albumApi } from '@/services/album-api';
import type { Album, AlbumPhoto } from '@/types/album';

type Status = 'loading' | 'ready' | 'error' | 'not-found';

async function fetchAlbumWithPhotos(albumId: string) {
  const album = await albumApi.getAlbum(albumId);
  if (!album) return null;
  const photos = await albumApi.getPhotos(albumId);
  return { album, photos };
}

/** Un album et ses photos, mis à jour automatiquement après un upload. */
export function useAlbum(albumId: string) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAlbumWithPhotos(albumId)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setStatus('not-found');
          return;
        }
        setAlbum(result.album);
        setPhotos(result.photos);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    const unsubscribe = albumApi.subscribe((changedAlbumId, nextPhotos) => {
      if (changedAlbumId !== albumId) return;
      setPhotos(nextPhotos);
      // Le nom, la période ou les membres ont pu changer (écran de gestion).
      albumApi.getAlbum(albumId).then((result) => {
        if (active && result) setAlbum(result);
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [albumId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchAlbumWithPhotos(albumId);
      if (!result) {
        setStatus('not-found');
        return;
      }
      setAlbum(result.album);
      setPhotos(result.photos);
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, [albumId]);

  return { album, photos, status, refreshing, refresh };
}
