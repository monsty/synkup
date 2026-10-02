/**
 * Fausse API du profil utilisateur, persistée localement (SQLite kv-store) pour survivre
 * aux redémarrages. À remplacer par de vrais appels réseau vers `api/`.
 */
import Storage from 'expo-sqlite/kv-store';

export type Profile = {
  nickname: string;
  email: string;
  avatarUri: string | null;
  /** ISO 8601 : date d'inscription. */
  memberSince: string;
};

const STORAGE_KEY = 'profile';
const NETWORK_DELAY_MS = 350;

const DEFAULT_PROFILE: Profile = {
  nickname: 'Antoine',
  email: 'antoine@example.com',
  avatarUri: 'https://i.pravatar.cc/240?img=12',
  memberSince: '2026-09-01T10:00:00.000Z',
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function read(): Profile {
  try {
    const raw = Storage.getItemSync(STORAGE_KEY);
    return raw ? { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export type ProfileUpdate = Partial<Pick<Profile, 'nickname' | 'email' | 'avatarUri'>>;

export const profileApi = {
  async getProfile(): Promise<Profile> {
    await delay(NETWORK_DELAY_MS);
    return read();
  },

  async updateProfile(update: ProfileUpdate): Promise<Profile> {
    await delay(NETWORK_DELAY_MS);
    const next = { ...read(), ...update };
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(next));
    return next;
  },
};
