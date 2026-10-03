import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

type Props = Omit<TextInputProps, 'style'> & {
  /** Référence vers le champ natif, pour un focus différé par exemple. */
  inputRef?: React.Ref<TextInput>;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Message sous le champ : erreur en rose, sinon aide en muted. */
  error?: string | null;
  hint?: string;
};

const FOCUS_MS = 150;

/**
 * Champ de saisie : carte blanche arrondie, libellé au-dessus, bordure rose au focus,
 * bouton d'effacement quand le champ a du contenu, message d'aide ou d'erreur dessous.
 */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  inputRef,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  const frameStyle = useAnimatedStyle(() => ({
    borderColor: error ? Palette.pink : `rgba(255, 45, 138, ${0.0 + focus.get() * 1})`,
  }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.frame, frameStyle]}>
        <TextInput
          ref={inputRef}
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocused(true);
            focus.set(withTiming(1, { duration: FOCUS_MS }));
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            focus.set(withTiming(0, { duration: FOCUS_MS }));
            inputProps.onBlur?.(e);
          }}
          placeholderTextColor={Palette.textMuted}
          selectionColor={Palette.pink}
          style={styles.input}
        />
        {focused && value.length > 0 && (
          <Pressable
            accessibilityLabel={`Effacer ${label.toLowerCase()}`}
            onPress={() => onChangeText('')}
            hitSlop={8}
            style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}>
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={11}
              weight="heavy"
              tintColor={Palette.text}
              fallback={<Text style={styles.clearFallback}>✕</Text>}
            />
          </Pressable>
        )}
      </Animated.View>
      {(error || hint) && (
        <Text style={[styles.message, error ? styles.messageError : null]}>{error ?? hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one + Spacing.half,
  },
  label: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.one,
  },
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    borderRadius: Radii.tile,
    borderWidth: 2,
    backgroundColor: Palette.card,
  },
  input: {
    flex: 1,
    height: '100%',
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '700',
    paddingVertical: 0,
  },
  clear: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Palette.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearPressed: {
    opacity: 0.7,
  },
  clearFallback: {
    color: Palette.text,
    fontSize: 11,
    fontWeight: '900',
  },
  message: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: Spacing.one,
  },
  messageError: {
    color: Palette.pink,
  },
});
