import { savePendingInvite } from '@/services/pending-invite';

/** `…/join/<jeton>` : lien web, `synkup://join/…` ou, en développement, `exp://…/--/join/…`. */
const JOIN_LINK = /\/join\/([A-Za-z0-9_-]+)/;

/**
 * Chaque lien entrant passe ici avant la navigation. Une invitation est gardée de côté : si
 * personne n'est connecté, l'écran de connexion s'affiche à la place, et l'accueil rouvrira
 * l'invitation juste après. Le chemin, lui, n'est pas modifié.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const token = JOIN_LINK.exec(path)?.[1];
    if (token) savePendingInvite(token);
  } catch {
    // Ne jamais bloquer l'ouverture d'un lien.
  }
  return path;
}
