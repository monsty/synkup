import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Palette, Radii, Spacing } from '@/constants/theme';

const FADE_MS = 150;
const SLIDE_IN = { damping: 24, stiffness: 260, overshootClamping: true };
/** Glissement vers le bas au-delà duquel la feuille se ferme. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 700;

type Props = {
  children: React.ReactNode;
  /** Libellé du fond, qui ferme au tap. */
  dismissLabel?: string;
  /** Appelé une fois le fondu de sortie terminé : le parent peut alors démonter la feuille. */
  onClose: () => void;
};

/**
 * Feuille coulissante par le bas, rendue en calque (pas une route) : ouverture et fermeture
 * instantanées. Fond dépoli, poignée, fermeture au tap sur le fond, au glissement vers le
 * bas, ou au retour Android. Le parent doit la monter avec une clé unique par ouverture.
 * Les boutons à l'intérieur doivent être des `Pressable` de Gesture Handler pour qu'un
 * glissement commencé dessus ferme quand même la feuille.
 */
export function BottomSheet({ children, dismissLabel = 'Fermer', onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [closing, setClosing] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);

  const backdrop = useSharedValue(0);
  const translateY = useSharedValue(600);
  const closed = useSharedValue(false);
  const unmounted = useSharedValue(false);

  useEffect(() => {
    backdrop.set(withTiming(1, { duration: FADE_MS }));
    return () => {
      unmounted.set(true);
    };
  }, [backdrop, unmounted]);

  // La feuille glisse depuis le bas dès que sa hauteur est connue.
  useEffect(() => {
    if (sheetHeight > 0) translateY.set(withSpring(0, SLIDE_IN));
  }, [sheetHeight, translateY]);

  const close = () => {
    if (closed.get()) return;
    closed.set(true);
    setClosing(true);
    backdrop.set(withTiming(0, { duration: FADE_MS }));
    translateY.set(
      withTiming(sheetHeight || 600, { duration: FADE_MS + 50 }, (finished) => {
        if (finished && !unmounted.get()) scheduleOnRN(onClose);
      })
    );
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = Gesture.Pan()
    .minDistance(6)
    .onUpdate((event) => {
      // Vers le haut, la feuille résiste ; vers le bas, elle suit le doigt.
      translateY.set(event.translationY > 0 ? event.translationY : event.translationY * 0.15);
    })
    .onEnd((event) => {
      if (translateY.get() > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(close);
        return;
      }
      translateY.set(withSpring(0, SLIDE_IN));
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
    opacity: interpolate(translateY.get(), [0, sheetHeight || 600], [1, 0.6], Extrapolation.CLAMP),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={closing ? 'none' : 'auto'}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView
          intensity={40}
          tint="light"
          blurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.frost]} />
      </Animated.View>

      {/* Tap sur le fond : ferme. */}
      <Pressable
        accessibilityLabel={dismissLabel}
        onPress={close}
        style={StyleSheet.absoluteFill}
      />

      <GestureDetector gesture={pan}>
        <Animated.View
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, Spacing.three) + Spacing.two },
            sheetStyle,
          ]}>
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  frost: {
    backgroundColor: 'rgba(244, 244, 247, 0.45)',
  },
  sheet: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    bottom: Spacing.two,
    borderRadius: Radii.card,
    backgroundColor: Palette.card,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surfaceStrong,
    marginBottom: Spacing.one,
  },
});
