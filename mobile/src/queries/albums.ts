/**
 * Albums via TanStack Query : clés de cache, lectures et mutations.
 *
 * Règle : après une mutation, on écrit la réponse dans le cache du détail et on marque la
 * liste périmée. Tous les écrans abonnés se mettent à jour d'eux-mêmes.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import {
  albumApi,
  type CreateAlbumInput,
  type UpdateAlbumInput,
} from '@/services/album-api';
import { getCurrentUserId } from '@/services/auth-api';
import { pruneAlbumThumbs, pruneAlbums } from '@/services/thumbnail-store';
import { removeAlbumUploads } from '@/services/upload-queue';
import type { Album, AlbumRole } from '@/types/album';

export const albumKeys = {
  all: ['albums'] as const,
  list: () => [...albumKeys.all, 'list'] as const,
  detail: (albumId: string) => [...albumKeys.all, 'detail', albumId] as const,
  photos: (albumId: string) => [...albumKeys.all, 'photos', albumId] as const,
  invite: (albumId: string) => [...albumKeys.all, 'invite', albumId] as const,
};

export const inviteKeys = {
  preview: (token: string) => ['invites', token] as const,
};

/** Un album a changé : son détail prend la réponse du serveur, la liste se recharge. */
function storeAlbum(client: QueryClient, album: Album) {
  client.setQueryData(albumKeys.detail(album.id), album);
  return client.invalidateQueries({ queryKey: albumKeys.list() });
}

/** Liste des albums ; au passage, les miniatures des albums quittés ou supprimés partent. */
async function fetchAlbums() {
  const albums = await albumApi.getAlbums();
  pruneAlbums(albums.map((a) => a.id));
  return albums;
}

export function useAlbumsQuery() {
  return useQuery({ queryKey: albumKeys.list(), queryFn: fetchAlbums });
}

/** Détail d'un album ; `null` s'il n'existe pas ou si je n'en suis pas membre. */
export function useAlbumQuery(albumId: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: albumKeys.detail(albumId),
    queryFn: () => albumApi.getAlbum(albumId),
    // Venant de la liste, l'album s'affiche tout de suite (et reste affiché hors ligne),
    // puis se rafraîchit selon l'âge de la liste.
    initialData: () => client.getQueryData<Album[]>(albumKeys.list())?.find((a) => a.id === albumId),
    initialDataUpdatedAt: () => client.getQueryState(albumKeys.list())?.dataUpdatedAt,
  });
}

export function useAlbumPhotosQuery(albumId: string) {
  return useQuery({
    queryKey: albumKeys.photos(albumId),
    queryFn: async () => {
      const photos = await albumApi.getPhotos(albumId);
      pruneAlbumThumbs(albumId, photos.map((p) => p.id));
      return photos;
    },
  });
}

/** Chiffres du profil : albums partagés avec moi, photos que j'y ai envoyées. */
export function useMyStats() {
  return useQuery({
    queryKey: albumKeys.list(),
    queryFn: fetchAlbums,
    select: (albums) => {
      const me = getCurrentUserId();
      const photosShared = albums.reduce(
        (sum, a) => sum + (a.members.find((m) => m.id === me)?.photoCount ?? 0),
        0
      );
      return { albums: albums.length, photosShared };
    },
  });
}

export function useCreateAlbum() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlbumInput) => albumApi.createAlbum(input),
    onSuccess: (album) => storeAlbum(client, album),
  });
}

export function useUpdateAlbum(albumId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAlbumInput) => albumApi.updateAlbum(albumId, input),
    onSuccess: (album) => storeAlbum(client, album),
  });
}

export function useDeleteAlbum() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (albumId: string) => albumApi.deleteAlbum(albumId),
    onSuccess: (_, albumId) => {
      removeAlbumUploads(albumId);
      // Les écrans encore ouverts sur cet album (détail, gestion) gardent leurs données le
      // temps de se fermer : on ne retire que le cache que plus personne n'affiche.
      client.removeQueries({ queryKey: albumKeys.detail(albumId), type: 'inactive' });
      client.removeQueries({ queryKey: albumKeys.photos(albumId), type: 'inactive' });
      return client.invalidateQueries({ queryKey: albumKeys.list() });
    },
  });
}

/** Quitter un album (membre) : il disparaît de ma liste, ses envois en attente aussi. */
export function useLeaveAlbum() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (albumId: string) => albumApi.leaveAlbum(albumId),
    onSuccess: (_, albumId) => {
      removeAlbumUploads(albumId);
      client.removeQueries({ queryKey: albumKeys.detail(albumId), type: 'inactive' });
      client.removeQueries({ queryKey: albumKeys.photos(albumId), type: 'inactive' });
      return client.invalidateQueries({ queryKey: albumKeys.list() });
    },
  });
}

export function useUpdateMemberRole(albumId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: AlbumRole }) =>
      albumApi.updateMemberRole(albumId, memberId, role),
    onSuccess: (album) => storeAlbum(client, album),
  });
}

export function useRemoveMember(albumId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => albumApi.removeMember(albumId, memberId),
    onSuccess: (album) => storeAlbum(client, album),
  });
}

/** Photos et compteurs ont changé : l'album, ses photos et la liste se rechargent. */
function invalidatePhotos(client: QueryClient, albumId: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: albumKeys.photos(albumId) }),
    client.invalidateQueries({ queryKey: albumKeys.detail(albumId) }),
    client.invalidateQueries({ queryKey: albumKeys.list() }),
  ]);
}

export function useDeletePhotos(albumId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (photoIds: string[]) => albumApi.deletePhotos(albumId, photoIds),
    onSuccess: () => invalidatePhotos(client, albumId),
  });
}

/** Lien d'invitation de l'album : stable tant que le propriétaire ne le remplace pas. */
export function useAlbumInvite(albumId: string) {
  return useQuery({
    queryKey: albumKeys.invite(albumId),
    queryFn: () => albumApi.getInvite(albumId),
    staleTime: 60 * 60 * 1000,
  });
}

export function useResetInvite(albumId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => albumApi.resetInvite(albumId),
    onSuccess: (invite) => client.setQueryData(albumKeys.invite(albumId), invite),
  });
}

/** Aperçu d'un lien d'invitation ; `null` s'il n'est plus valide. Toujours relu au réseau. */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: inviteKeys.preview(token),
    queryFn: () => albumApi.previewInvite(token),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useAcceptInvite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => albumApi.acceptInvite(token),
    onSuccess: (album) => storeAlbum(client, album),
  });
}
