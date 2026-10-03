/**
 * Réglages de l'utilisateur, persistés localement par compte (SQLite kv-store).
 * À remplacer par l'API quand le backend existera.
 */
import Storage from 'expo-sqlite/kv-store';

import { getCurrentUserId } from '@/services/auth-api';
import type { PlanId } from '@/constants/plans';

export type Language = 'fr' | 'en';

export type NotificationSettings = {
  /** Photos ajoutées dans les albums que j'ai créés. */
  ownedAlbums: boolean;
  /** Photos ajoutées dans les albums où je suis simplement membre. */
  memberAlbums: boolean;
};

export type Settings = {
  language: Language;
  notifications: NotificationSettings;
  plan: PlanId;
};

const DEFAULT_SETTINGS: Settings = {
  language: 'fr',
  notifications: { ownedAlbums: true, memberAlbums: true },
  plan: 'free',
};

const NETWORK_DELAY_MS = 250;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function storageKey() {
  return `settings:${getCurrentUserId()}`;
}

function read(): Settings {
  try {
    const raw = Storage.getItemSync(storageKey());
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Lecture immédiate (pour les calculs côté API albums, ex. date d'expiration). */
export function getSettingsSync(): Settings {
  return read();
}

export const settingsApi = {
  async getSettings(): Promise<Settings> {
    await delay(NETWORK_DELAY_MS);
    return read();
  },

  async updateLanguage(language: Language): Promise<Settings> {
    const next = { ...read(), language };
    Storage.setItemSync(storageKey(), JSON.stringify(next));
    return next;
  },

  async updateNotifications(update: Partial<NotificationSettings>): Promise<Settings> {
    const next = { ...read() };
    next.notifications = { ...next.notifications, ...update };
    Storage.setItemSync(storageKey(), JSON.stringify(next));
    return next;
  },
};
