/**
 * Utilisateur courant, tenu à jour par `AuthProvider` à partir de la session Clerk.
 *
 * La session elle-même (jetons, rafraîchissement, stockage sécurisé) est gérée par Clerk.
 * Ce module ne garde qu'une copie synchrone de l'utilisateur, pour les stockages locaux qui
 * préfixent leurs clés par son identifiant (photos triées, profil, réglages…).
 */

export type AuthProvider = 'email' | 'apple' | 'google';

export type User = {
  /** Identifiant Clerk (`user_…`). */
  id: string;
  email: string;
  /** Moyen de connexion du compte : Google, Apple, ou code par email. */
  provider: AuthProvider;
};

let currentUser: User | null = null;

export function setCurrentUser(user: User | null): void {
  currentUser = user;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

/** Identifiant pour préfixer les données locales : un changement de compte ne mélange rien. */
export function getCurrentUserId(): string {
  return currentUser?.id ?? 'anonymous';
}
