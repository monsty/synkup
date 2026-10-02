/**
 * Fausse API de l'album partagé, en mémoire.
 * À remplacer par de vrais appels réseau vers `api/` quand le backend existera.
 */
import type { Album, AlbumPhoto } from '@/types/album';

const NETWORK_DELAY_MS = 350;
const UPLOAD_DELAY_MS = 900;
const SEED_PHOTO_COUNT = 30;

const DEFAULT_ALBUM: Album = {
  id: 'album-default',
  name: 'Septembre entre potes',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
};

const AUTHORS = ['Antoine', 'Léa', 'Mehdi', 'Camille', 'Jules', 'Inès'];
const SIZES: [number, number][] = [
  [600, 800],
  [800, 600],
  [700, 700],
  [600, 900],
  [900, 600],
];

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function seedPhotos(): AlbumPhoto[] {
  return Array.from({ length: SEED_PHOTO_COUNT }, (_, i) => {
    const [width, height] = SIZES[i % SIZES.length];
    const day = 1 + ((i * 7) % 30);
    const takenAt = new Date(2026, 8, day, 9 + (i % 11), (i * 13) % 60);
    return {
      id: `seed-${i}`,
      uri: `https://picsum.photos/seed/synkup-${i}/${width}/${height}`,
      width,
      height,
      takenAt: takenAt.toISOString(),
      authorName: AUTHORS[i % AUTHORS.length],
    };
  });
}

function sortByDateDesc(photos: AlbumPhoto[]): AlbumPhoto[] {
  return [...photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

type Listener = (photos: AlbumPhoto[]) => void;

let photos: AlbumPhoto[] = seedPhotos();
const listeners = new Set<Listener>();

function notify() {
  const snapshot = sortByDateDesc(photos);
  listeners.forEach((listener) => listener(snapshot));
}

export type PhotoContext = {
  photo: AlbumPhoto;
  index: number;
  count: number;
  previous: AlbumPhoto | null;
  next: AlbumPhoto | null;
};

export type UploadPhotoInput = {
  localUri: string;
  width: number | null;
  height: number | null;
  takenAt: number | null;
};

export const albumApi = {
  async getDefaultAlbum(): Promise<Album> {
    await delay(NETWORK_DELAY_MS);
    return DEFAULT_ALBUM;
  },

  async getPhotos(_albumId: string): Promise<AlbumPhoto[]> {
    await delay(NETWORK_DELAY_MS);
    return sortByDateDesc(photos);
  },

  async getPhoto(photoId: string): Promise<AlbumPhoto | null> {
    return photos.find((photo) => photo.id === photoId) ?? null;
  },

  /** Une photo avec sa position dans l'album et ses voisines, pour le visualiseur. */
  async getPhotoContext(photoId: string): Promise<PhotoContext | null> {
    const sorted = sortByDateDesc(photos);
    const index = sorted.findIndex((photo) => photo.id === photoId);
    if (index === -1) return null;
    return {
      photo: sorted[index],
      index,
      count: sorted.length,
      previous: sorted[index - 1] ?? null,
      next: sorted[index + 1] ?? null,
    };
  },

  async uploadPhoto(_albumId: string, input: UploadPhotoInput): Promise<AlbumPhoto> {
    await delay(UPLOAD_DELAY_MS);
    const photo: AlbumPhoto = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri: input.localUri,
      width: input.width ?? 1000,
      height: input.height ?? 1000,
      takenAt: new Date(input.takenAt ?? Date.now()).toISOString(),
      authorName: 'Moi',
    };
    photos = [photo, ...photos];
    notify();
    return photo;
  },

  /** Notifie quand la liste de photos change (après un upload par exemple). */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
