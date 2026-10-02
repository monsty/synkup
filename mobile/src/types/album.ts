/** Un album partagé, borné dans le temps. Les dates sont au format YYYY-MM-DD (local). */
export type Album = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

/** Une photo déjà présente dans l'album partagé. */
export type AlbumPhoto = {
  id: string;
  uri: string;
  width: number;
  height: number;
  /** ISO 8601 */
  takenAt: string;
  authorName: string;
};

/** Une photo de la galerie du téléphone, candidate à l'envoi. */
export type GalleryPhoto = {
  /** Identifiant natif (ph:// sur iOS, content:// sur Android). Affichable tel quel par expo-image. */
  id: string;
  width: number | null;
  height: number | null;
  /** Timestamp en millisecondes, ou null si inconnu. */
  creationTime: number | null;
};

export type ReviewDecision = 'sent' | 'skipped';

/** Bornes locales inclusives d'un album : début à 00:00:00, fin à 23:59:59.999. */
export function getAlbumRange(album: Album): { start: Date; end: Date } {
  const [sy, sm, sd] = album.startDate.split('-').map(Number);
  const [ey, em, ed] = album.endDate.split('-').map(Number);
  return {
    start: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
    end: new Date(ey, em - 1, ed, 23, 59, 59, 999),
  };
}

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const shortDateWithYear = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Ex. « 1 sept. → 30 sept. 2026 » */
export function formatAlbumRange(album: Album): string {
  const { start, end } = getAlbumRange(album);
  return `${shortDate.format(start)} → ${shortDateWithYear.format(end)}`;
}

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Ex. « mar. 15 sept. 14:32 » */
export function formatPhotoDate(value: string | number | null): string {
  if (value === null) return 'Date inconnue';
  return dayFormatter.format(new Date(value));
}
