/**
 * Prépare et envoie une photo de la galerie vers le bucket, sans passer par l'API :
 * 1. lit l'originale (HEIC, JPEG…) et calcule son empreinte SHA-256 ;
 * 2. demande des URL d'envoi à l'API (qui refuse tout de suite un doublon ou un album plein) ;
 * 3. prépare l'affichage (1 600 px) et la miniature (480 px) en JPEG ;
 * 4. envoie les trois fichiers, puis confirme à l'API.
 */
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { File, UploadType } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Asset } from 'expo-media-library';

import { ApiError, apiRequest } from '@/services/api-client';
import { keepUploadedThumb } from '@/services/thumbnail-store';
import type { GalleryPhoto } from '@/types/album';

/** Côté le plus long de la version d'affichage (plein écran, couverture). */
const DISPLAY_MAX = 1600;
/** Côté le plus court de la miniature : une case de la grille fait ~400 px. */
const THUMB_MIN = 480;

/** Formats d'originale acceptés par l'API ; le reste est converti en JPEG. */
const ORIGINAL_TYPES = new Set(['image/jpeg', 'image/heic', 'image/heif', 'image/png', 'image/webp']);

type UploadUrls = { photoId: string; uploads: { original: string; display: string; thumb: string } };

export type UploadedPhotoDto = { id: string };

/** La photo était déjà dans l'album : rien n'a été envoyé. */
export class DuplicatePhotoError extends Error {}

/** Fichier local de l'originale : asset de la galerie (ph://…) ou fichier déjà local. */
async function originalUri(photo: GalleryPhoto): Promise<string> {
  if (photo.id.startsWith('file://')) return photo.id;
  return new Asset(photo.id).getUri();
}

async function sha256(file: File): Promise<string> {
  const hash = await digest(CryptoDigestAlgorithm.SHA256, await file.bytes());
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

type Size = { width: number; height: number };

/** Dimensions de l'image : celles de la galerie si connues, sinon en la décodant. */
async function sizeOf(uri: string, photo: GalleryPhoto): Promise<Size> {
  if (photo.width && photo.height) return { width: photo.width, height: photo.height };
  const { width, height } = await ImageManipulator.manipulate(uri).renderAsync();
  return { width, height };
}

/**
 * JPEG redimensionné, jamais agrandi. `fit` : on borne le côté le plus long ou le plus court.
 * Sans `size`, simple conversion en JPEG à la résolution d'origine.
 */
async function toJpeg(
  uri: string,
  compress: number,
  resize?: { source: Size; size: number; fit: 'long' | 'short' }
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  if (resize) {
    const { source, size, fit } = resize;
    const landscape = source.width >= source.height;
    const boundWidth = fit === 'long' ? landscape : !landscape;
    if ((boundWidth ? source.width : source.height) > size) {
      context.resize(boundWidth ? { width: size } : { height: size });
    }
  }
  const image = await (await context.renderAsync()).saveAsync({ compress, format: SaveFormat.JPEG });
  return image.uri;
}

async function put(uri: string, url: string, contentType: string) {
  const result = await new File(uri).upload(url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
    sessionType: 'foreground',
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Envoi refusé par le stockage (${result.status}).`);
  }
}

function discard(...uris: string[]) {
  for (const uri of uris) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Fichier de cache : le système le nettoiera.
    }
  }
}

export async function uploadGalleryPhoto(
  albumId: string,
  photo: GalleryPhoto
): Promise<UploadedPhotoDto> {
  const temporary: string[] = [];
  try {
    let original = new File(await originalUri(photo));
    let contentType = original.type;
    if (!ORIGINAL_TYPES.has(contentType)) {
      // GIF, TIFF… : on garde une originale en JPEG pleine résolution.
      const converted = await toJpeg(original.uri, 0.95);
      temporary.push(converted);
      original = new File(converted);
      contentType = 'image/jpeg';
    }

    const source = await sizeOf(original.uri, photo);
    const [display, thumb] = await Promise.all([
      toJpeg(original.uri, 0.82, { source, size: DISPLAY_MAX, fit: 'long' }),
      toJpeg(original.uri, 0.7, { source, size: THUMB_MIN, fit: 'short' }),
    ]);
    temporary.push(display, thumb);

    const meta = {
      contentHash: await sha256(original),
      contentType,
      width: source.width,
      height: source.height,
      takenAt: new Date(photo.creationTime ?? Date.now()).toISOString(),
    };

    let urls: UploadUrls;
    try {
      urls = await apiRequest<UploadUrls>('POST', `/albums/${albumId}/photos/uploads`, meta);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) throw new DuplicatePhotoError();
      throw error;
    }

    await Promise.all([
      put(original.uri, urls.uploads.original, contentType),
      put(display, urls.uploads.display, 'image/jpeg'),
      put(thumb, urls.uploads.thumb, 'image/jpeg'),
    ]);

    const uploaded = await apiRequest<UploadedPhotoDto>('POST', `/albums/${albumId}/photos`, {
      ...meta,
      photoId: urls.photoId,
    });
    // La miniature est déjà là : on la garde pour la grille hors ligne.
    await keepUploadedThumb(albumId, uploaded.id, thumb);
    return uploaded;
  } finally {
    discard(...temporary);
  }
}

/** Couverture choisie à la main : une seule version, en JPEG d'affichage. Renvoie sa clé. */
export async function uploadCover(albumId: string, localUri: string): Promise<string> {
  const { width, height } = await ImageManipulator.manipulate(localUri).renderAsync();
  const cover = await toJpeg(localUri, 0.82, {
    source: { width, height },
    size: DISPLAY_MAX,
    fit: 'long',
  });
  try {
    const { key, uploadUrl } = await apiRequest<{ key: string; uploadUrl: string }>(
      'POST',
      `/albums/${albumId}/cover`
    );
    await put(cover, uploadUrl, 'image/jpeg');
    return key;
  } finally {
    discard(cover);
  }
}
