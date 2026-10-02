import { useCallback, useEffect, useState } from 'react';

import { albumApi } from '@/services/album-api';
import type { Album, AlbumPhoto } from '@/types/album';

type Status = 'loading' | 'ready' | 'error';

async function fetchAlbumWithPhotos() {
  const album = await albumApi.getDefaultAlbum();
  const photos = await albumApi.getPhotos(album.id);
  return { album, photos };
}

/** Album par défaut + ses photos, mis à jour automatiquement après un upload. */
export function useAlbum() {
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAlbumWithPhotos()
      .then((result) => {
        if (!active) return;
        setAlbum(result.album);
        setPhotos(result.photos);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    const unsubscribe = albumApi.subscribe(setPhotos);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchAlbumWithPhotos();
      setAlbum(result.album);
      setPhotos(result.photos);
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { album, photos, status, refreshing, refresh };
}
