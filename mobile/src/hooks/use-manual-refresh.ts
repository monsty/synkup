import { useCallback, useState } from 'react';

/**
 * Tirer pour rafraîchir : le spinner ne suit que le geste de l'utilisateur, pas les
 * rechargements d'arrière-plan de TanStack (retour dans l'app, réseau retrouvé…).
 */
export function useManualRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, refresh };
}
