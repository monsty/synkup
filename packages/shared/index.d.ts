/**
 * Contrat de l'API Synkup (`/v1`), partagé par l'app et l'API.
 *
 * Uniquement des types (`import type`) : rien n'est chargé à l'exécution, donc ni Metro ni
 * Nest n'ont à résoudre ce paquet. Un changement de forme casse la compilation des deux
 * côtés au lieu de casser l'app en silence. Fichier de déclarations (`.d.ts`) : il n'est pas
 * compilé avec l'API et ne change pas la structure de son build.
 */

export type AlbumRole = 'owner' | 'member';

export type AlbumMemberDto = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: AlbumRole;
  /** Photos envoyées par ce membre dans l'album. */
  photoCount: number;
};

export type AlbumDto = {
  id: string;
  name: string;
  /** Date locale YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  /** URL de lecture signée de la couverture (choisie à la main ou dernière photo). */
  coverUrl: string | null;
  /** Clé stable pour le cache d'images : l'URL signée change chaque jour. */
  coverCacheKey: string | null;
  hasCustomCover: boolean;
  photoCount: number;
  myRole: AlbumRole;
  members: AlbumMemberDto[];
};

export type PhotoDto = {
  id: string;
  width: number;
  height: number;
  /** ISO 8601. */
  takenAt: string;
  authorId: string;
  authorName: string;
  originalUrl: string;
  displayUrl: string;
  thumbUrl: string;
};

/** Réponse de `POST /albums/:id/photos/uploads`. */
export type PhotoUploadUrlsDto = {
  photoId: string;
  uploads: { original: string; display: string; thumb: string };
};

/** Réponse de `POST /albums/:id/cover`. */
export type CoverUploadUrlDto = {
  key: string;
  uploadUrl: string;
};

/** Lien d'invitation actif d'un album. */
export type InviteDto = {
  token: string;
  /** Lien à partager (et contenu du QR code). */
  url: string;
};

/** Ce que voit une personne invitée avant de rejoindre. */
export type InvitePreviewDto = {
  token: string;
  alreadyMember: boolean;
  album: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    coverUrl: string | null;
    coverCacheKey: string | null;
    ownerName: string;
    memberCount: number;
    /** Les premiers membres, pour les avatars. */
    members: { id: string; name: string; avatarUrl: string | null }[];
  };
};

/** Corps d'une réponse d'erreur. */
export type ApiErrorDto = {
  statusCode: number;
  message: string | string[];
  /** Cas que l'app traite à part : `duplicate`, `quota_reached`… */
  code?: string;
};
