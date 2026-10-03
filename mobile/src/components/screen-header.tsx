import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

/** Bouton de 40, un peu d'air au-dessus et davantage en dessous pour ne pas coller au filet. */
export const HEADER_ROW_PADDING_TOP = Spacing.one;
export const HEADER_ROW_PADDING_BOTTOM = Spacing.two + Spacing.half;
const ROW_PADDING_TOP = HEADER_ROW_PADDING_TOP;
const ROW_PADDING_BOTTOM = HEADER_ROW_PADDING_BOTTOM;
export const HEADER_ROW_HEIGHT = 40 + ROW_PADDING_TOP + ROW_PADDING_BOTTOM;

type Props = {
  /** Bouton à gauche de la marque (retour, ✕…). */
  left?: React.ReactNode;
  /** Étiquette ou boutons à droite de la marque. */
  right?: React.ReactNode;
  /** Vrai dès que le contenu a défilé sous l'en-tête : un filet apparaît pour le détacher. */
  scrolled?: boolean;
  /** Marque centrée entre deux emplacements de 40 (connexion). Sinon alignée à gauche. */
  centered?: boolean;
};

/**
 * En-tête collant : couvre la barre de statut et reste en place pendant que le contenu
 * défile dessous. Fond opaque `background`, filet bas qui apparaît au scroll.
 */
export function ScreenHeader({ left, right, scrolled = false, centered = false }: Props) {
  const insets = useSafeAreaInsets();
  const dividerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(scrolled ? 1 : 0, { duration: 150 }),
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {left ?? (centered ? <View style={styles.slot} /> : null)}
        <Text style={[styles.brand, centered && styles.brandCentered]}>Synkup</Text>
        {right ?? (centered ? <View style={styles.slot} /> : null)}
      </View>
      <Animated.View style={[styles.divider, dividerStyle]} />
    </View>
  );
}

type BackButtonProps = {
  accessibilityLabel?: string;
  /** Route de repli si l'écran est seul dans la pile (deep link). */
  fallbackHref?: '/';
  /** Retour interne à l'écran (étape précédente) au lieu de la navigation. */
  onPress?: () => void;
};

/** Chevron de retour, rond gris 40, à placer dans `left` de `ScreenHeader`. */
export function BackButton({
  accessibilityLabel = 'Retour',
  fallbackHref = '/',
  onPress,
}: BackButtonProps) {
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(fallbackHref));
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress ?? goBack}
      hitSlop={8}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
        size={18}
        weight="heavy"
        tintColor={Palette.text}
        fallback={<Text style={styles.roundButtonFallback}>‹</Text>}
      />
    </Pressable>
  );
}

/** Seuil de défilement au-delà duquel l'en-tête affiche son filet. */
export const HEADER_SCROLL_THRESHOLD = 4;

const styles = StyleSheet.create({
  // Pas de zIndex : les calques (visualiseur, feuilles, modales) rendus après doivent
  // passer au-dessus de l'en-tête.
  container: {
    backgroundColor: Palette.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: HEADER_ROW_HEIGHT,
    paddingHorizontal: Spacing.three,
    paddingTop: ROW_PADDING_TOP,
    paddingBottom: ROW_PADDING_BOTTOM,
  },
  slot: {
    width: 40,
    height: 40,
  },
  brand: {
    flex: 1,
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandCentered: {
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.surfaceStrong,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonFallback: {
    color: Palette.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});
