/**
 * Mémorise, par album, les photos de la galerie déjà proposées à l'utilisateur
 * (envoyées ou passées) pour ne jamais les re-proposer.
 * Stockage local SQLite via expo-sqlite/kv-store.
 */
import Storage from 'expo-sqlite/kv-store';

import { getCurrentUserId } from '@/services/auth-api';

import type { ReviewDecision } from '@/types/album';

type ReviewMap = Record<string, ReviewDecision>;

function storageKey(albumId: string) {
  // Préfixé par l'utilisateur : deux comptes sur le même téléphone ne se mélangent pas.
  return `reviews:${getCurrentUserId()}:${albumId}`;
}

export function getReviews(albumId: string): ReviewMap {
  try {
    const raw = Storage.getItemSync(storageKey(albumId));
    return raw ? (JSON.parse(raw) as ReviewMap) : {};
  } catch {
    return {};
  }
}

export function saveReview(albumId: string, assetId: string, decision: ReviewDecision): void {
  const reviews = getReviews(albumId);
  reviews[assetId] = decision;
  Storage.setItemSync(storageKey(albumId), JSON.stringify(reviews));
}

/** Oublie une décision : la photo sera de nouveau proposée au tri (envoi abandonné). */
export function removeReview(albumId: string, assetId: string): void {
  const reviews = getReviews(albumId);
  if (!(assetId in reviews)) return;
  delete reviews[assetId];
  Storage.setItemSync(storageKey(albumId), JSON.stringify(reviews));
}

/** Utile en dev pour re-tester le swipe depuis zéro. */
export function clearReviews(albumId: string): void {
  Storage.removeItemSync(storageKey(albumId));
}
