/**
 * Accès en lecture à la galerie du téléphone via expo-media-library (API « next », SDK 57).
 */
import { AssetField, MediaType, Query } from 'expo-media-library';

import type { GalleryPhoto } from '@/types/album';

/** Photos (pas de vidéos) prises entre `start` et `end` inclus, les plus récentes d'abord. */
export async function getGalleryPhotosBetween(start: Date, end: Date): Promise<GalleryPhoto[]> {
  const metadata = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .gte(AssetField.CREATION_TIME, start.getTime())
    .lte(AssetField.CREATION_TIME, end.getTime())
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .exeForMetadata();

  return metadata.map((asset) => ({
    id: asset.id,
    width: asset.width,
    height: asset.height,
    creationTime: asset.creationTime,
  }));
}
