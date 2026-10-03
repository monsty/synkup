/**
 * Appels à l'API des albums (`api/`). Pas d'état ici : le cache et les rechargements sont
 * gérés par TanStack Query (`src/queries/albums.ts`).
 *
 * Transition : les photos ne sont pas encore stockées côté serveur (le bucket viendra ensuite).
 * Celles envoyées depuis le téléphone restent en mémoire, rattachées à leur album, et sont
 * fusionnées dans le compteur et la couverture renvoyés par l'API.
 */
import { apiRequest, ApiError } from '@/services/api-client';
import { getCurrentUserId } from '@/services/auth-api';
import {
  getAlbumRange,
  getAlbumStatus,
  type Album,
  type AlbumPhoto,
  type AlbumRole,
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

/** Photos envoyées depuis ce téléphone, par album, triées par date décroissante. */
const localPhotos = new Map<string, AlbumPhoto[]>();

function photosOf(albumId: string): AlbumPhoto[] {
  return localPhotos.get(albumId) ?? [];
}

function sortByDateDesc(photos: AlbumPhoto[]): AlbumPhoto[] {
  return [...photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

function toAlbum(dto: AlbumDto): Album {
  const local = photosOf(dto.id);
  const me = getCurrentUserId();
  return {
    id: dto.id,
    name: dto.name,
    startDate: dto.startDate,
    endDate: dto.endDate,
    coverUri: dto.hasCustomCover ? dto.coverUrl : (local[0]?.uri ?? dto.coverUrl),
    hasCustomCover: dto.hasCustomCover,
    photoCount: dto.photoCount + local.length,
    myRole: dto.myRole,
    members: dto.members.map((m) => ({
      id: m.id,
      name: m.name,
      avatarUri: m.avatarUrl,
      role: m.role,
      photoCount: m.photoCount + (m.id === me ? local.length : 0),
    })),
  };
}

export type CreateAlbumInput = {
  name: string;
  startDate: string;
  endDate: string;
};

export type UpdateAlbumInput = Partial<CreateAlbumInput> & {
  /** `null` pour revenir à la dernière photo de l'album. */
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

export type UploadPhotoInput = {
  localUri: string;
  width: number | null;
  height: number | null;
  takenAt: number | null;
};

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
    return photosOf(albumId);
  },

  /** Transition : la photo reste sur le téléphone, en attendant le stockage côté serveur. */
  async uploadPhoto(albumId: string, input: UploadPhotoInput): Promise<AlbumPhoto> {
    const photo: AlbumPhoto = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri: input.localUri,
      width: input.width ?? 1000,
      height: input.height ?? 1000,
      takenAt: new Date(input.takenAt ?? Date.now()).toISOString(),
      authorName: 'Moi',
    };
    localPhotos.set(albumId, sortByDateDesc([photo, ...photosOf(albumId)]));
    return photo;
  },

  /** Nom, période ou couverture : le serveur refuse si je ne suis pas propriétaire. */
  async updateAlbum(albumId: string, input: UpdateAlbumInput): Promise<Album> {
    const { coverUri, ...rest } = input;
    const body = coverUri === undefined ? rest : { ...rest, coverUrl: coverUri };
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
    localPhotos.delete(albumId);
  },

  /** Supprime des photos de l'album. Transition : photos locales seulement. */
  async deletePhotos(albumId: string, photoIds: string[]): Promise<void> {
    const ids = new Set(photoIds);
    localPhotos.set(
      albumId,
      photosOf(albumId).filter((p) => !ids.has(p.id))
    );
  },
};
