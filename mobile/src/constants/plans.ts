/** Offres d'abonnement. Le quota compte les photos des albums que j'ai créés. */
export type PlanId = 'free' | 'pro' | 'ultra';

export type Plan = {
  id: PlanId;
  name: string;
  /** Nombre maximal de photos dans l'ensemble de mes albums. */
  photoQuota: number;
  /** Prix mensuel en euros, 0 pour l'offre gratuite. POC : prix indicatifs. */
  monthlyPrice: number;
  tagline: string;
};

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Gratuit',
    photoQuota: 1_000,
    monthlyPrice: 0,
    tagline: 'Pour un week-end ou une soirée',
  },
  {
    id: 'pro',
    name: 'Pro',
    photoQuota: 25_000,
    monthlyPrice: 4.99,
    tagline: "Pour tous les albums de l'année",
  },
  {
    id: 'ultra',
    name: 'Ultra',
    photoQuota: 250_000,
    monthlyPrice: 19.99,
    tagline: 'Pour les grands groupes et les pros',
  },
];

export function getPlan(id: PlanId): Plan {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}

const number = new Intl.NumberFormat('fr-FR');

export function formatQuota(value: number): string {
  return number.format(value);
}

export function formatPrice(plan: Plan): string {
  if (plan.monthlyPrice === 0) return 'Gratuit';
  return `${plan.monthlyPrice.toFixed(2).replace('.', ',')} € / mois`;
}
