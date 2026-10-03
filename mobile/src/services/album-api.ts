/**
 * Fausse API des albums partagés, en mémoire.
 * À remplacer par de vrais appels réseau vers `api/` quand le backend existera.
 */
import {
  getAlbumStatus,
  getAlbumRange,
  type Album,
  type AlbumMember,
  type AlbumRole,
  type AlbumPhoto,
} from '@/types/album';

const NETWORK_DELAY_MS = 350;
const UPLOAD_DELAY_MS = 900;

const SIZES: [number, number][] = [
  [600, 800],
  [800, 600],
  [700, 700],
  [600, 900],
  [900, 600],
];

/** Identifiant de l'utilisateur courant dans les données de démo. */
const ME = 'me';

type Person = Omit<AlbumMember, 'role' | 'photoCount'>;

const PEOPLE: Person[] = [
  { id: 'me', name: 'Moi', avatarUri: 'https://i.pravatar.cc/120?img=12' },
  { id: 'lea', name: 'Léa', avatarUri: 'https://i.pravatar.cc/120?img=47' },
  { id: 'mehdi', name: 'Mehdi', avatarUri: 'https://i.pravatar.cc/120?img=33' },
  { id: 'camille', name: 'Camille', avatarUri: 'https://i.pravatar.cc/120?img=5' },
  { id: 'jules', name: 'Jules', avatarUri: 'https://i.pravatar.cc/120?img=59' },
  { id: 'ines', name: 'Inès', avatarUri: 'https://i.pravatar.cc/120?img=26' },
  { id: 'sacha', name: 'Sacha', avatarUri: 'https://i.pravatar.cc/120?img=68' },
];

type MemberSeed = { id: string; role: AlbumRole };

type AlbumSeed = Omit<
  Album,
  'coverUri' | 'hasCustomCover' | 'photoCount' | 'members' | 'myRole'
> & {
  members: MemberSeed[];
  /** Couverture choisie par le propriétaire ; sinon la dernière photo de l'album. */
  coverUri?: string | null;
  photoCount: number;
  /** Décalage de graine pour que chaque album ait ses propres images. */
  seed: number;
};

/** Albums connus : les graines de démo, plus ceux créés pendant la session. */
const ALBUM_SEEDS: AlbumSeed[] = [
  {
    id: 'lisbonne',
    name: 'Week-end à Lisbonne',
    startDate: '2026-10-02',
    endDate: '2026-10-05',
    members: [
      { id: 'me', role: 'owner' },
      { id: 'lea', role: 'member' },
      { id: 'mehdi', role: 'member' },
      { id: 'camille', role: 'member' },
    ],
    photoCount: 12,
    seed: 200,
  },
  {
    id: 'anniv-lea',
    name: 'Anniversaire de Léa',
    startDate: '2026-10-17',
    endDate: '2026-10-17',
    members: [
      { id: 'lea', role: 'owner' },
      { id: 'jules', role: 'member' },
      { id: 'me', role: 'member' },
      { id: 'ines', role: 'member' },
      { id: 'sacha', role: 'member' },
      { id: 'camille', role: 'member' },
    ],
    photoCount: 0,
    seed: 300,
  },
  {
    id: 'album-default',
    name: 'Septembre entre potes',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    members: [
      { id: 'me', role: 'owner' },
      { id: 'lea', role: 'member' },
      { id: 'mehdi', role: 'member' },
      { id: 'camille', role: 'member' },
      { id: 'jules', role: 'member' },
      { id: 'ines', role: 'member' },
    ],
    photoCount: 30,
    seed: 0,
  },
  {
    id: 'ete-2026',
    name: "Vacances d'été",
    startDate: '2026-08-10',
    endDate: '2026-08-24',
    members: [
      { id: 'sacha', role: 'owner' },
      { id: 'me', role: 'member' },
      { id: 'jules', role: 'member' },
    ],
    photoCount: 48,
    seed: 400,
  },
];

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function dateIn(album: AlbumSeed, index: number): Date {
  const [sy, sm, sd] = album.startDate.split('-').map(Number);
  const [ey, em, ed] = album.endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd).getTime();
  const end = new Date(ey, em - 1, ed).getTime();
  const span = Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
  const day = (index * 7) % span;
  return new Date(
    start + day * 24 * 60 * 60 * 1000 + (9 + (index % 11)) * 3600_000 + ((index * 13) % 60) * 60_000
  );
}

function seedPhotos(album: AlbumSeed): AlbumPhoto[] {
  const authors = album.members.map((m) => PEOPLE.find((p) => p.id === m.id)?.name ?? 'Invité');
  return Array.from({ length: album.photoCount }, (_, i) => {
    const [width, height] = SIZES[i % SIZES.length];
    const n = album.seed + i;
    return {
      id: `seed-${n}`,
      uri: `https://picsum.photos/seed/synkup-${n}/${width}/${height}`,
      width,
      height,
      takenAt: dateIn(album, i).toISOString(),
      authorName: authors[i % authors.length],
    };
  });
}

function sortByDateDesc(photos: AlbumPhoto[]): AlbumPhoto[] {
  return [...photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

/** Photos par album, triées par date décroissante. */
const photosByAlbum = new Map<string, AlbumPhoto[]>(
  ALBUM_SEEDS.map((seed) => [seed.id, sortByDateDesc(seedPhotos(seed))])
);

function toAlbum(seed: AlbumSeed): Album {
  const photos = photosByAlbum.get(seed.id) ?? [];
  const members = seed.members
    .map((m) => {
      const person = PEOPLE.find((p) => p.id === m.id);
      if (!person) return null;
      const photoCount = photos.filter((photo) => photo.authorName === person.name).length;
      return { ...person, role: m.role, photoCount };
    })
    .filter((m): m is AlbumMember => !!m);
  return {
    id: seed.id,
    name: seed.name,
    startDate: seed.startDate,
    endDate: seed.endDate,
    coverUri: seed.coverUri ?? photos[0]?.uri ?? null,
    hasCustomCover: !!seed.coverUri,
    members,
    photoCount: photos.length,
    myRole: seed.members.find((m) => m.id === ME)?.role ?? 'member',
  };
}

function findSeed(albumId: string): AlbumSeed {
  const seed = ALBUM_SEEDS.find((a) => a.id === albumId);
  if (!seed) throw new Error('Album introuvable.');
  return seed;
}

type Listener = (albumId: string, photos: AlbumPhoto[]) => void;
const listeners = new Set<Listener>();

function notify(albumId: string) {
  const snapshot = photosByAlbum.get(albumId) ?? [];
  listeners.forEach((listener) => listener(albumId, snapshot));
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
    await delay(NETWORK_DELAY_MS);
    return sortAlbums(ALBUM_SEEDS.map(toAlbum));
  },

  /** Crée un album dont je suis le seul membre pour l'instant ; les invitations viendront après. */
  async createAlbum(input: CreateAlbumInput): Promise<Album> {
    await delay(NETWORK_DELAY_MS);
    const seed: AlbumSeed = {
      id: `album-${Date.now().toString(36)}`,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      members: [{ id: ME, role: 'owner' }],
      photoCount: 0,
      seed: 0,
    };
    ALBUM_SEEDS.push(seed);
    photosByAlbum.set(seed.id, []);
    notify(seed.id);
    return toAlbum(seed);
  },

  async getAlbum(albumId: string): Promise<Album | null> {
    await delay(NETWORK_DELAY_MS);
    const seed = ALBUM_SEEDS.find((a) => a.id === albumId);
    return seed ? toAlbum(seed) : null;
  },

  async getPhotos(albumId: string): Promise<AlbumPhoto[]> {
    await delay(NETWORK_DELAY_MS);
    return photosByAlbum.get(albumId) ?? [];
  },

  async uploadPhoto(albumId: string, input: UploadPhotoInput): Promise<AlbumPhoto> {
    await delay(UPLOAD_DELAY_MS);
    const photo: AlbumPhoto = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri: input.localUri,
      width: input.width ?? 1000,
      height: input.height ?? 1000,
      takenAt: new Date(input.takenAt ?? Date.now()).toISOString(),
      authorName: 'Moi',
    };
    photosByAlbum.set(albumId, sortByDateDesc([photo, ...(photosByAlbum.get(albumId) ?? [])]));
    notify(albumId);
    return photo;
  },

  /** Chiffres pour l'écran de profil : albums partagés avec moi, photos que j'ai envoyées. */
  async getMyStats(): Promise<{ albums: number; photosShared: number }> {
    await delay(NETWORK_DELAY_MS);
    let photosShared = 0;
    for (const photos of photosByAlbum.values()) {
      photosShared += photos.filter((p) => p.authorName === 'Moi').length;
    }
    return { albums: ALBUM_SEEDS.length, photosShared };
  },

  /** Modifie le nom ou la période. POC : sans contrôle de rôle côté serveur. */
  async updateAlbum(albumId: string, input: UpdateAlbumInput): Promise<Album> {
    await delay(NETWORK_DELAY_MS);
    const seed = findSeed(albumId);
    if (input.name !== undefined) seed.name = input.name;
    if (input.startDate !== undefined) seed.startDate = input.startDate;
    if (input.endDate !== undefined) seed.endDate = input.endDate;
    if (input.coverUri !== undefined) seed.coverUri = input.coverUri;
    notify(albumId);
    return toAlbum(seed);
  },

  /** Change le rôle d'un membre. Nommer un nouveau propriétaire rétrograde l'ancien en membre. */
  async updateMemberRole(albumId: string, memberId: string, role: AlbumRole): Promise<Album> {
    await delay(NETWORK_DELAY_MS);
    const seed = findSeed(albumId);
    const target = seed.members.find((m) => m.id === memberId);
    if (!target) throw new Error('Membre introuvable.');
    if (role === 'owner') {
      for (const m of seed.members) if (m.role === 'owner') m.role = 'member';
    }
    target.role = role;
    notify(albumId);
    return toAlbum(seed);
  },

  async removeMember(albumId: string, memberId: string): Promise<Album> {
    await delay(NETWORK_DELAY_MS);
    const seed = findSeed(albumId);
    seed.members = seed.members.filter((m) => m.id !== memberId);
    notify(albumId);
    return toAlbum(seed);
  },

  /** Supprime des photos de l'album. POC : sans contrôle d'auteur. */
  async deletePhotos(albumId: string, photoIds: string[]): Promise<void> {
    await delay(NETWORK_DELAY_MS);
    const ids = new Set(photoIds);
    photosByAlbum.set(
      albumId,
      (photosByAlbum.get(albumId) ?? []).filter((p) => !ids.has(p.id))
    );
    notify(albumId);
  },

  /** Notifie quand les photos d'un album changent (après un upload par exemple). */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
