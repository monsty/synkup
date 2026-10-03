import { useManualRefresh } from '@/hooks/use-manual-refresh';
import { useAlbumsQuery } from '@/queries/albums';

type Status = 'loading' | 'ready' | 'error';

/** Liste des albums de l'utilisateur ; se met à jour après chaque création, modification ou envoi. */
export function useAlbums() {
  const query = useAlbumsQuery();
  const { refreshing, refresh } = useManualRefresh(query.refetch);
  const status: Status = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';
  return { albums: query.data ?? [], status, refreshing, refresh };
}
