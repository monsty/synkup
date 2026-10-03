/**
 * Fausse API du profil utilisateur, persistée localement (SQLite kv-store) pour survivre
 * aux redémarrages. À remplacer par de vrais appels réseau vers `api/`.
 */
import Storage from 'expo-sqlite/kv-store';

import { getCurrentUser, getCurrentUserId } from '@/services/auth-api';

export type Profile = {
  nickname: string;
  email: string;
  avatarUri: string | null;
  /** ISO 8601 : date d'inscription. */
  memberSince: string;
};

const NETWORK_DELAY_MS = 350;

function storageKey() {
  return `profile:${getCurrentUserId()}`;
}

/** Profil initial d'un compte : surnom déduit de l'email, avatar pour les comptes de démo. */
function defaultProfile(): Profile {
  const user = getCurrentUser();
  const email = user?.email ?? '';
  const local = email.split('@')[0] ?? '';
  const nickname = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Moi';
  return {
    nickname,
    email,
    avatarUri: user && user.provider !== 'email' ? 'https://i.pravatar.cc/240?img=12' : null,
    memberSince: new Date().toISOString(),
  };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function read(): Profile {
  const fallback = defaultProfile();
  try {
    const raw = Storage.getItemSync(storageKey());
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Profile>) } : fallback;
  } catch {
    return fallback;
  }
}

export type ProfileUpdate = Partial<Pick<Profile, 'nickname' | 'email' | 'avatarUri'>>;

/** Lecture immédiate du profil local : l'écran s'affiche sans chargement. */
export function getProfileSync(): Profile {
  return read();
}

export const profileApi = {
  async getProfile(): Promise<Profile> {
    await delay(NETWORK_DELAY_MS);
    return read();
  },

  async updateProfile(update: ProfileUpdate): Promise<Profile> {
    await delay(NETWORK_DELAY_MS);
    const next = { ...read(), ...update };
    Storage.setItemSync(storageKey(), JSON.stringify(next));
    return next;
  },
};
