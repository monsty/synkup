/** Le compte connecté via TanStack Query : profil, offre et usage, mise à jour, suppression. */
import type { MeDto } from '@synkup/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { albumKeys } from '@/queries/albums';
import { meApi, type MeUpdate } from '@/services/me-api';

export const meKeys = {
  me: ['me'] as const,
};

export function useMeQuery() {
  return useQuery({ queryKey: meKeys.me, queryFn: meApi.getMe });
}

/** Usage du quota (photos des albums dont je suis propriétaire), tel que l'API le compte. */
export function useMyUsage() {
  return useQuery({
    queryKey: meKeys.me,
    queryFn: meApi.getMe,
    select: (me: MeDto) => me.usage,
  });
}

export function useUpdateMe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (update: MeUpdate) => meApi.updateMe(update),
    onSuccess: (me) => {
      client.setQueryData(meKeys.me, me);
      // Mon surnom et ma photo apparaissent dans la liste des membres de mes albums.
      return client.invalidateQueries({ queryKey: albumKeys.all });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: () => meApi.deleteMe() });
}
