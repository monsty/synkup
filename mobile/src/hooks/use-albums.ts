import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { useAlbumsQuery } from '@/queries/albums';

type Status = 'loading' | 'ready' | 'error';

/** Liste des albums de l'utilisateur ; se met à jour après chaque création, modification ou envoi. */
export function useAlbums() {
  const query = useAlbumsQuery();
  const { refreshing, refresh } = useManualRefresh(query.refetch);
  // Des données en cache (même anciennes) valent mieux qu'un écran d'erreur hors ligne.
  const status: Status =
    query.data !== undefined ? 'ready' : query.isError ? 'error' : 'loading';
  return { albums: query.data ?? [], status, refreshing, refresh };
}
