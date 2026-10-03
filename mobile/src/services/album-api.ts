/**
 * Appels à l'API des albums (`api/`). Pas d'état ici : le cache et les rechargements sont
 * gérés par TanStack Query (`src/queries/albums.ts`).
 */
import { ApiError, apiRequest } from '@/services/api-client';
import { uploadCover, uploadGalleryPhoto } from '@/services/photo-upload';
import {
  getAlbumRange,
  getAlbumStatus,
  type Album,
  type AlbumPhoto,
  type AlbumRole,
  type GalleryPhoto,
} from '@/types/album';

/** Album tel que renvoyé par l'API. */
type AlbumDto = Omit<Album, 'coverUri' | 'members'> & {
  coverUrl: string | null;
  members: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: AlbumRole;
    photoCount: number;
  }[];
};

type PhotoDto = Omit<AlbumPhoto, 'uri' | 'thumbUri' | 'originalUri'> & {
  displayUrl: string;
  thumbUrl: string;
  originalUrl: string;
};

function toAlbum(dto: AlbumDto): Album {
  return {
    id: dto.id,
    name: dto.name,
    startDate: dto.startDate,
    endDate: dto.endDate,
    coverUri: dto.coverUrl,
    coverCacheKey: dto.coverCacheKey,
    hasCustomCover: dto.hasCustomCover,
    photoCount: dto.photoCount,
    myRole: dto.myRole,
    members: dto.members.map((m) => ({
      id: m.id,
      name: m.name,
      avatarUri: m.avatarUrl,
      role: m.role,
      photoCount: m.photoCount,
    })),
  };
}

function toPhoto({ displayUrl, thumbUrl, originalUrl, ...dto }: PhotoDto): AlbumPhoto {
  return { ...dto, uri: displayUrl, thumbUri: thumbUrl, originalUri: originalUrl };
}

export type CreateAlbumInput = {
  name: string;
  startDate: string;
  endDate: string;
};

export type UpdateAlbumInput = Partial<CreateAlbumInput> & {
  /** Image locale choisie comme couverture ; `null` pour revenir à la dernière photo. */
  coverUri?: string | null;
};

/** En cours d'abord, puis à venir (le plus proche en premier), puis terminés (le plus récent). */
function sortAlbums(albums: Album[]): Album[] {
  const rank: Record<ReturnType<typeof getAlbumStatus>, number> = {
    active: 0,
    upcoming: 1,
    ended: 2,
  };
  return [...albums].sort((a, b) => {
    const sa = getAlbumStatus(a);
    const sb = getAlbumStatus(b);
    if (sa !== sb) return rank[sa] - rank[sb];
    const ra = getAlbumRange(a);
    const rb = getAlbumRange(b);
    if (sa === 'ended') return rb.end.getTime() - ra.end.getTime();
    return ra.start.getTime() - rb.start.getTime();
  });
}

export const albumApi = {
  /** Albums de l'utilisateur : en cours d'abord, puis à venir, puis terminés du plus récent. */
  async getAlbums(): Promise<Album[]> {
    const albums = await apiRequest<AlbumDto[]>('GET', '/albums');
    return sortAlbums(albums.map(toAlbum));
  },

  /** Crée un album dont je suis le seul membre pour l'instant ; les invitations viendront après. */
  async createAlbum(input: CreateAlbumInput): Promise<Album> {
    return toAlbum(await apiRequest<AlbumDto>('POST', '/albums', input));
  },

  /** `null` si l'album n'existe pas ou si je n'en suis pas membre. */
  async getAlbum(albumId: string): Promise<Album | null> {
    try {
      return toAlbum(await apiRequest<AlbumDto>('GET', `/albums/${albumId}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async getPhotos(albumId: string): Promise<AlbumPhoto[]> {
    const photos = await apiRequest<PhotoDto[]>('GET', `/albums/${albumId}/photos`);
    return photos.map(toPhoto);
  },

  /** Envoie une photo de la galerie ; `DuplicatePhotoError` si elle est déjà dans l'album. */
  async uploadPhoto(albumId: string, photo: GalleryPhoto): Promise<{ id: string }> {
    return uploadGalleryPhoto(albumId, photo);
  },

  /** Nom, période ou couverture : le serveur refuse si je ne suis pas propriétaire. */
  async updateAlbum(albumId: string, input: UpdateAlbumInput): Promise<Album> {
    const { coverUri, ...rest } = input;
    // Une nouvelle couverture est d'abord envoyée au stockage ; l'album retient sa clé.
    const coverKey = coverUri ? await uploadCover(albumId, coverUri) : coverUri;
    const body = coverKey === undefined ? rest : { ...rest, coverKey };
    return toAlbum(await apiRequest<AlbumDto>('PATCH', `/albums/${albumId}`, body));
  },

  /** Change le rôle d'un membre. Nommer un nouveau propriétaire rétrograde l'ancien en membre. */
  async updateMemberRole(albumId: string, memberId: string, role: AlbumRole): Promise<Album> {
    return toAlbum(
      await apiRequest<AlbumDto>('PATCH', `/albums/${albumId}/members/${memberId}`, { role })
    );
  },

  async removeMember(albumId: string, memberId: string): Promise<Album> {
    return toAlbum(
      await apiRequest<AlbumDto>('DELETE', `/albums/${albumId}/members/${memberId}`)
    );
  },

  /** Supprime un album et toutes ses photos (propriétaire). Libère le quota. */
  async deleteAlbum(albumId: string): Promise<void> {
    await apiRequest<void>('DELETE', `/albums/${albumId}`);
  },

  /** Supprime des photos : les siennes, ou toutes pour le propriétaire. */
  async deletePhotos(albumId: string, photoIds: string[]): Promise<void> {
    await apiRequest<void>('POST', `/albums/${albumId}/photos/delete`, { ids: photoIds });
  },
};
