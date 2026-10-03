import { router, type Href } from 'expo-router';

/**
 * Fenêtre pendant laquelle un second `push` est ignoré. Couvre le temps entre deux taps
 * très rapprochés et le début de la transition, avant que la pile ne reflète le premier.
 */
const LOCK_MS = 700;

let lockedUntil = 0;

/**
 * `router.push` protégé contre le double tap : le premier appel passe, les suivants sont
 * ignorés pendant quelques centaines de millisecondes. Complète `dangerouslySingular`, qui
 * dédoublonne la pile mais seulement une fois la première navigation enregistrée.
 */
export function pushOnce(href: Href): void {
  const now = Date.now();
  if (now < lockedUntil) return;
  lockedUntil = now + LOCK_MS;
  router.push(href);
}
