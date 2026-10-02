import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

type Props = {
  value: number | string;
  style?: TextStyle;
};

/** Largeur d'une cellule de chiffre, relative à la taille de police (chiffres à chasse fixe). */
const DIGIT_WIDTH_RATIO = 0.62;

/**
 * Nombre dont seuls les chiffres qui changent s'animent : l'ancien chiffre sort vers le haut,
 * le nouveau arrive par le bas. Les positions sont indexées depuis la droite pour que
 * les unités restent stables quand le nombre perd un chiffre (10 → 9).
 */
export function AnimatedCounter({ value, style }: Props) {
  const flat: TextStyle = StyleSheet.flatten([styles.text, style]);
  const fontSize = flat.fontSize ?? 18;
  const lineHeight = flat.lineHeight ?? fontSize * 1.25;
  const chars = String(value).split('');

  return (
    <View style={[styles.row, { height: lineHeight }]}>
      {chars.map((char, index) => {
        const positionFromRight = chars.length - 1 - index;
        const isDigit = /\d/.test(char);
        return (
          <View
            key={positionFromRight}
            style={[
              styles.cell,
              { height: lineHeight },
              isDigit && { width: fontSize * DIGIT_WIDTH_RATIO },
            ]}>
            {isDigit ? (
              <Animated.Text
                key={`${positionFromRight}-${char}`}
                entering={FadeInDown.duration(220)}
                exiting={FadeOutUp.duration(180)}
                style={[flat, styles.digit]}>
                {char}
              </Animated.Text>
            ) : (
              <Text style={flat}>{char}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  digit: {
    position: 'absolute',
    textAlign: 'center',
  },
});
