/** Rangement des médias dans le bucket : tout ce qui concerne un album vit sous son préfixe. */

export const albumPrefix = (albumId: string) => `albums/${albumId}/`;

export type PhotoVariant = 'original' | 'display' | 'thumb';

/** Extension de l'originale d'après son type MIME. */
export const ORIGINAL_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Miniature et affichage sont toujours des JPEG, préparés par le téléphone. */
export function photoKey(
  albumId: string,
  photoId: string,
  variant: PhotoVariant,
  contentType: string,
) {
  const ext = variant === 'original' ? ORIGINAL_EXTENSIONS[contentType] : 'jpg';
  return `${albumPrefix(albumId)}photos/${photoId}/${variant}.${ext}`;
}

/**
 * Tailles maximales acceptées, en octets. Intégrées à la signature des URL d'envoi : le
 * stockage refuse lui-même un fichier qui ne fait pas la taille annoncée.
 */
export const MAX_BYTES = {
  original: 50 * 1024 * 1024,
  display: 5 * 1024 * 1024,
  thumb: 1024 * 1024,
  cover: 5 * 1024 * 1024,
} as const;

export const coverPrefix = (albumId: string) => `${albumPrefix(albumId)}cover/`;
