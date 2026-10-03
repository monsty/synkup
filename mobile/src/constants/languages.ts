import type { Language } from '@/services/settings-api';

export type LanguageOption = {
  code: Language;
  /** Nom dans la langue elle-même, ce que l'utilisateur reconnaît d'abord. */
  nativeName: string;
  /** Nom dans la langue courante de l'app (français pour l'instant). */
  localizedName: string;
  /** Faux tant que les traductions ne sont pas prêtes : affiché mais non sélectionnable. */
  available: boolean;
};

/** Langues proposées. La liste s'allongera : l'écran est une liste, pas des pastilles. */
export const LANGUAGES: LanguageOption[] = [
  { code: 'fr', nativeName: 'Français', localizedName: 'Français', available: true },
  { code: 'en', nativeName: 'English', localizedName: 'Anglais', available: false },
];

export function getLanguage(code: Language): LanguageOption {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}
