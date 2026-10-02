import { useCallback, useEffect, useState } from 'react';

import { albumApi } from '@/services/album-api';
import type { Album } from '@/types/album';

type Status = 'loading' | 'ready' | 'error';

/** Liste des albums de l'utilisateur, rechargée après chaque ajout de photo. */
export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    albumApi
      .getAlbums()
      .then((result) => {
        if (!active) return;
        setAlbums(result);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    // Un upload change la couverture et le compteur : on recharge la liste.
    const unsubscribe = albumApi.subscribe(() => {
      albumApi.getAlbums().then((result) => {
        if (active) setAlbums(result);
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setAlbums(await albumApi.getAlbums());
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { albums, status, refreshing, refresh };
}
