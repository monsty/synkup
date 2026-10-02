import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Palette } from '@/constants/theme';

export const ADD_BUTTON_SIZE = 68;
/** Liquid Glass (iOS 26+) ; ailleurs on garde le rond rose plein. */
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();
/** Soulèvement à la pression : léger agrandissement et éclaircissement, sans déformation. */
const PRESSED_SCALE = 1.08;
const PRESSED_GLOW = 0.22;
const SPRING = { damping: 14, stiffness: 260 };

type Props = {
  accessibilityLabel: string;
  onPress: () => void;
  /** Distance au bord bas de l'écran. */
  bottom: number;
};

/** Bouton + flottant, rond rose : l'action principale « ajouter » de l'écran. */
export function AddButton({ accessibilityLabel, onPress, bottom }: Props) {
  // Le mode interactif natif du verre étire le bouton sous le doigt : on anime nous-mêmes.
  const pressed = useSharedValue(0);
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, PRESSED_SCALE]) }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: pressed.get() * PRESSED_GLOW }));

  const icon = (
    <SymbolView
      name={{ ios: 'plus', android: 'add', web: 'add' }}
      size={30}
      weight="heavy"
      tintColor={Palette.onPhoto}
      fallback={<Text style={styles.fallback}>+</Text>}
    />
  );

  return (
    // Pas de <Link asChild> ici : son Slot écrase un style passé en fonction.
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => pressed.set(withSpring(1, SPRING))}
      onPressOut={() => pressed.set(withSpring(0, SPRING))}
      style={[styles.wrap, { bottom }]}>
      <Animated.View style={liftStyle}>
        {HAS_LIQUID_GLASS ? (
          // Pas d'`isInteractive` : il étire et déforme le verre sous le doigt.
          <GlassView glassEffectStyle="regular" tintColor={Palette.pinkGlass} style={styles.disc}>
            {icon}
            <Animated.View style={[styles.glow, glowStyle]} />
          </GlassView>
        ) : (
          <View style={[styles.disc, styles.solid]}>
            {icon}
            <Animated.View style={[styles.glow, glowStyle]} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    // Pas d'ombre ni d'opacité ici : sur le parent d'une GlassView, ça casse l'effet de verre.
  },
  disc: {
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    borderRadius: ADD_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    backgroundColor: Palette.pink,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  /** Voile blanc enfant du verre (une opacité sur un enfant ne casse pas l'effet). */
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: ADD_BUTTON_SIZE / 2,
    backgroundColor: '#FFFFFF',
    pointerEvents: 'none',
  },
  fallback: {
    color: Palette.onPhoto,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
});
