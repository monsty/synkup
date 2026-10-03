/** Rôle d'un membre dans un album. Un seul propriétaire par album. */
export type AlbumRole = 'owner' | 'member';

export const ROLE_LABEL: Record<AlbumRole, string> = {
  owner: 'Propriétaire',
  member: 'Membre',
};

/** Une personne ayant accès à un album. */
export type AlbumMember = {
  id: string;
  name: string;
  avatarUri: string;
  role: AlbumRole;
  /** Photos envoyées par ce membre dans l'album. */
  photoCount: number;
};

/** Seul le propriétaire modifie le nom, la période et gère les membres. */
export function canEditAlbum(role: AlbumRole): boolean {
  return role === 'owner';
}

/** Le propriétaire peut transférer la propriété à un membre. */
export function assignableRoles(actor: AlbumRole, target: AlbumRole): AlbumRole[] {
  return actor === 'owner' && target === 'member' ? ['owner'] : [];
}

/** Le propriétaire retire n'importe quel membre, jamais lui-même. */
export function canRemoveMember(actor: AlbumRole, target: AlbumRole): boolean {
  return actor === 'owner' && target === 'member';
}

/** Un album partagé, borné dans le temps. Les dates sont au format YYYY-MM-DD (local). */
export type Album = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /** Photo de couverture (en général la dernière ajoutée). */
  coverUri: string | null;
  /** Vrai si la couverture a été choisie à la main (sinon c'est la dernière photo). */
  hasCustomCover: boolean;
  members: AlbumMember[];
  photoCount: number;
  /** Mon rôle dans cet album. */
  myRole: AlbumRole;
};

export type AlbumStatus = 'upcoming' | 'active' | 'ended';

/** Date locale au format YYYY-MM-DD, celui des bornes d'album. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Où en est l'album par rapport à aujourd'hui. */
export function getAlbumStatus(album: Album, now = new Date()): AlbumStatus {
  const { start, end } = getAlbumRange(album);
  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'active';
}

/**
 * « aujourd'hui », « demain », « hier », « dans 3 jours », « il y a 5 jours ».
 * Écrit à la main : Intl.RelativeTimeFormat n'est pas disponible dans Hermes sous Expo Go.
 */
function relativeDays(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days === -1) return 'hier';
  if (days === 2) return 'après-demain';
  if (days === -2) return 'avant-hier';
  return days > 0 ? `dans ${days} jours` : `il y a ${-days} jours`;
}

function daysBetween(from: Date, to: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / dayMs);
}

/**
 * Phrase d'état courte pour la liste des albums.
 * Ex. « Se termine dans 3 jours », « Terminé avant-hier », « Commence le 17 oct. »
 */
export function describeAlbumStatus(album: Album, now = new Date()): string {
  const { start, end } = getAlbumRange(album);
  const status = getAlbumStatus(album, now);
  if (status === 'active') {
    return `Se termine ${relativeDays(daysBetween(now, end))}`;
  }
  if (status === 'upcoming') {
    const days = daysBetween(now, start);
    if (days <= 7) return `Commence ${relativeDays(days)}`;
    return `Commence le ${shortDate.format(start)}`;
  }
  const days = daysBetween(end, now);
  if (days <= 7) return `Terminé ${relativeDays(-days)}`;
  return `Terminé le ${shortDate.format(end)}`;
}

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
