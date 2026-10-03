/**
 * Données d'un compte gardées sur le téléphone : réglages, tris, registre des photos
 * téléchargées, cache des appels à l'API, miniatures hors ligne. Effacées quand le compte
 * est supprimé.
 */
import Storage from 'expo-sqlite/kv-store';

import { clearThumbs } from '@/services/thumbnail-store';

/** Préfixes des clés locales rangées par compte (voir chaque service). */
const PER_ACCOUNT_PREFIXES = [
  'settings:',
  'reviews:',
  'device-photos:',
  'query-cache:',
  'upload-queue:',
];

export function clearLocalAccountData(userId: string): void {
  clearThumbs();
  try {
    for (const key of Storage.getAllKeysSync()) {
      if (PER_ACCOUNT_PREFIXES.some((prefix) => key.startsWith(`${prefix}${userId}`))) {
        Storage.removeItemSync(key);
      }
    }
  } catch {
    // Au pire, des réglages orphelins restent : plus aucun compte ne les lira.
  }
}
