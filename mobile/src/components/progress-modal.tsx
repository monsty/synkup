import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

export type ProgressOverlay =
  | { kind: 'progress'; title: string; done: number; total: number }
  /** Attente sans avancement connu (le système prépare les photos choisies). */
  | { kind: 'busy'; title: string }
  | { kind: 'done'; text: string; error?: boolean };

type Props = {
  overlay: ProgressOverlay | null;
};

const FILL_DURATION_MS = 260;
/** Hauteur fixe de la carte : identique en progression et en résultat, pas de réajustement. */
const CARD_HEIGHT = 150;

/**
 * Modale centrée qui bloque l'écran pendant une opération par lots (enregistrement, envoi) :
 * titre, compteur, barre de progression (ou un spinner quand l'avancement est inconnu), puis
 * résultat avec une coche avant de disparaître. Pilotée par `useProgressOverlay`.
 */
export function ProgressModal({ overlay }: Props) {
  if (!overlay) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Fond dépoli : absorbe toutes les touches tant que la modale est là. */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={StyleSheet.absoluteFill}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.frost]} />
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        <Animated.View
          entering={ZoomIn.duration(180)}
          exiting={ZoomOut.duration(150)}
          style={styles.card}>
          {overlay.kind === 'progress' ? (
            <ProgressContent title={overlay.title} done={overlay.done} total={overlay.total} />
          ) : overlay.kind === 'busy' ? (
            <BusyContent title={overlay.title} />
          ) : (
            <DoneContent text={overlay.text} error={overlay.error} />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

function ProgressContent({ title, done, total }: { title: string; done: number; total: number }) {
  const ratio = total > 0 ? done / total : 0;
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: withTiming(ratio, { duration: FILL_DURATION_MS }) }],
  }));

  return (
    <>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        {done} / {total}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </>
  );
}

function BusyContent({ title }: { title: string }) {
  return (
    <>
      <ActivityIndicator size="large" color={Palette.pink} />
      <Text style={styles.title}>{title}</Text>
    </>
  );
}

function DoneContent({ text, error }: { text: string; error?: boolean }) {
  return (
    <>
      <Animated.View
        entering={ZoomIn.duration(160)}
        style={[styles.doneIcon, error && styles.doneIconError]}>
        <SymbolView
          name={
            error
              ? { ios: 'exclamationmark', android: 'priority_high', web: 'priority_high' }
              : { ios: 'checkmark', android: 'check', web: 'check' }
          }
          size={22}
          weight="heavy"
          tintColor={Palette.onPhoto}
          fallback={<Text style={styles.doneFallback}>{error ? '!' : '✓'}</Text>}
        />
      </Animated.View>
      <Text style={styles.title} numberOfLines={2}>
        {text}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  frost: {
    backgroundColor: 'rgba(244, 244, 247, 0.5)',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  card: {
    width: '100%',
    maxWidth: 260,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.card,
    backgroundColor: Palette.background,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surfaceStrong,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: Radii.pill,
    backgroundColor: Palette.pink,
    transformOrigin: 'left',
  },
  doneIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneIconError: {
    backgroundColor: Palette.text,
  },
  doneFallback: {
    color: Palette.onPhoto,
    fontSize: 26,
    fontWeight: '900',
  },
});
