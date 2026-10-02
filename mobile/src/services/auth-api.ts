/**
 * Fausse API d'authentification. La session (jeton + utilisateur) est persistée dans le
 * stockage sécurisé du téléphone (trousseau iOS / Keystore Android) : elle survit au kill
 * de l'app et au redémarrage, et disparaît à la désinstallation ou à la déconnexion.
 * À remplacer par un vrai fournisseur (Clerk, Supabase…) quand le backend existera.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type AuthProvider = 'email' | 'apple' | 'google';

export type User = {
  id: string;
  email: string;
  provider: AuthProvider;
};

export type Session = {
  token: string;
  user: User;
};

const SESSION_KEY = 'synkup.session';
const NETWORK_DELAY_MS = 500;
const CODE_PATTERN = /^\d{6}$/;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Utilisateur de la session courante, lisible de façon synchrone par les stores locaux. */
let currentUser: User | null = null;

export function getCurrentUser(): User | null {
  return currentUser;
}

/** Identifiant pour préfixer les données locales : un changement de compte ne mélange rien. */
export function getCurrentUserId(): string {
  return currentUser?.id ?? 'anonymous';
}

async function persist(session: Session | null): Promise<void> {
  currentUser = session?.user ?? null;
  // Pas de stockage sécurisé sur le web : la session ne survit pas au rechargement.
  if (Platform.OS === 'web') return;
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

function makeSession(user: User): Session {
  return { token: `fake-${user.id}-${Date.now().toString(36)}`, user };
}

function userFromEmail(email: string, provider: AuthProvider): User {
  const normalized = email.trim().toLowerCase();
  return { id: `${provider}:${normalized}`, email: normalized, provider };
}

export const authApi = {
  /** Relit la session enregistrée au lancement. Null si personne n'est connecté. */
  async restoreSession(): Promise<Session | null> {
    if (Platform.OS === 'web') return null;
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      const session = raw ? (JSON.parse(raw) as Session) : null;
      currentUser = session?.user ?? null;
      return session;
    } catch {
      return null;
    }
  },

  /** Envoie un code de connexion par email. POC : rien n'est envoyé. */
  async requestEmailCode(_email: string): Promise<void> {
    await delay(NETWORK_DELAY_MS);
  },

  /** Vérifie le code. POC : n'importe quel code à 6 chiffres est accepté. */
  async verifyEmailCode(email: string, code: string): Promise<Session> {
    await delay(NETWORK_DELAY_MS);
    if (!CODE_PATTERN.test(code.trim())) throw new Error('Code invalide.');
    const session = makeSession(userFromEmail(email, 'email'));
    await persist(session);
    return session;
  },

  /** Connexion Apple ou Google. POC : un compte de démonstration par fournisseur. */
  async signInWithProvider(provider: 'apple' | 'google'): Promise<Session> {
    await delay(NETWORK_DELAY_MS + 300);
    const email = provider === 'apple' ? 'antoine@icloud.com' : 'antoine@gmail.com';
    const session = makeSession(userFromEmail(email, provider));
    await persist(session);
    return session;
  },

  async signOut(): Promise<void> {
    await persist(null);
  },
};
