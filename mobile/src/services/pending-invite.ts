/**
 * Invitation ouverte avant d'être connecté : on garde le jeton le temps de la connexion, puis
 * l'accueil rouvre l'écran « Rejoindre ». Stockage local hors compte (personne n'est connecté).
 */
import Storage from 'expo-sqlite/kv-store';

const KEY = 'pending-invite';

export function savePendingInvite(token: string): void {
  Storage.setItemSync(KEY, token);
}

/** Renvoie le jeton en attente et l'efface : il ne sert qu'une fois. */
export function takePendingInvite(): string | null {
  try {
    const token = Storage.getItemSync(KEY);
    if (token) Storage.removeItemSync(KEY);
    return token;
  } catch {
    return null;
  }
}
