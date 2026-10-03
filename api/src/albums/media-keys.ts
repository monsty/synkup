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

export const coverPrefix = (albumId: string) => `${albumPrefix(albumId)}cover/`;
