import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { albumKeys } from '@/queries/albums';

/** En dessous, les URL viennent d'arriver : un échec n'est pas une expiration, on ne boucle pas. */
const MIN_AGE_MS = 60_000;

/**
 * Filet de sécurité des URL signées : une image qui ne se charge pas vient peut-être d'une URL
 * expirée (cache restauré, horloge déréglée…). On recharge alors les données concernées,
 * qui arrivent avec des URL fraîches, et l'image réessaie d'elle-même.
 *
 * `scope` : `photos` pour les photos d'un album, `albums` pour les couvertures.
 */
export function useExpiredUrlRetry(scope: 'photos' | 'albums') {
  const client = useQueryClient();
  return useCallback(() => {
    const prefix = scope === 'photos' ? [...albumKeys.all, 'photos'] : albumKeys.all;
    const before = Date.now() - MIN_AGE_MS;
    client.invalidateQueries({
      queryKey: prefix,
      predicate: (query) => query.state.dataUpdatedAt < before,
    });
  }, [client, scope]);
}
