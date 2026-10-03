import { Plan } from './generated/prisma/client.js';

/**
 * Photos actives autorisées par offre : celles des albums dont l'utilisateur est propriétaire.
 * Mêmes chiffres que l'app (`mobile/src/constants/plans.ts`).
 */
export const PHOTO_QUOTA: Record<Plan, number> = {
  [Plan.FREE]: 1_000,
  [Plan.PRO]: 25_000,
  [Plan.ULTRA]: 250_000,
};
