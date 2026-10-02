/**
 * Sélection manuelle de photos via le sélecteur natif du système (PHPicker sur iOS,
 * Photo Picker sur Android) : interface connue de l'utilisateur, et aucune permission
 * galerie nécessaire puisque seules les photos choisies sont transmises.
 */
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { GalleryPhoto } from '@/types/album';

/**
 * Identifiant comparable à ceux d'expo-media-library, pour reconnaître une photo déjà
 * triée ou envoyée. Sur iOS le sélecteur renvoie l'identifiant PHAsset nu, la médiathèque
 * le préfixe `ph://`. Sans identifiant (accès limité, fichier hors galerie), on retombe sur
 * l'URI du fichier.
 */
function toGalleryId(asset: ImagePicker.ImagePickerAsset): string {
  if (!asset.assetId) return asset.uri;
  if (Platform.OS === 'ios' && !asset.assetId.startsWith('ph://')) return `ph://${asset.assetId}`;
  return asset.assetId;
}

/** Ouvre le sélecteur natif en multi-sélection. Renvoie [] si l'utilisateur annule. */
export async function pickPhotosFromGallery(): Promise<GalleryPhoto[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    quality: 1,
    exif: false,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    id: toGalleryId(asset),
    width: asset.width || null,
    height: asset.height || null,
    // Le sélecteur ne donne pas la date de prise de vue : la médiathèque la fournira côté
    // API quand il y en aura une. En attendant, la photo est datée de son envoi.
    creationTime: null,
  }));
}

/**
 * Ouvre le sélecteur natif pour une seule image (photo de profil). Null si annulé.
 * Pas de recadrage : sur iOS, `allowsEditing` bascule sur l'ancien contrôleur photo, bien
 * plus lent à s'ouvrir que le sélecteur moderne. L'avatar est de toute façon affiché en rond
 * avec un cadrage centré.
 */
export async function pickSingleImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 0.8,
    exif: false,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
