/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    tint: '#208AEF',
    success: '#22C55E',
    danger: '#EF4444',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    tint: '#4DA3F5',
    success: '#4ADE80',
    danger: '#F87171',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Palette de l'app (thème clair fixe, accents « fun »). Voir DESIGN.md.
 * `Colors` ci-dessus ne sert plus qu'aux composants hérités du starter.
 */
export const Palette = {
  background: '#F4F4F7',
  /** Fond d'une carte posée sur `background` (liste des albums, menu). */
  card: '#FFFFFF',
  surface: 'rgba(27, 27, 31, 0.07)',
  surfaceStrong: 'rgba(27, 27, 31, 0.12)',
  /** Équivalent opaque de `surface` sur `background`, pour un élément posé sur des photos. */
  surfaceOpaque: '#E5E5EA',
  text: '#1B1B1F',
  textMuted: '#6B6B76',
  onPhoto: '#FFFFFF',
  mint: '#9FE8D8',
  /** Teinte menthe translucide pour les surfaces Liquid Glass. */
  mintGlass: 'rgba(159, 232, 216, 0.35)',
  pink: '#FF2D8A',
  /** Teinte rose translucide pour les surfaces Liquid Glass. */
  pinkGlass: 'rgba(255, 45, 138, 0.6)',
  onMint: '#14201C',
  cardBackground: '#E6E6EB',
} as const;

/** Rayons d'arrondi. Tout est très arrondi : les pilules sont des demi-cercles. */
export const Radii = {
  card: 40,
  tile: 18,
  pill: 999,
} as const;
