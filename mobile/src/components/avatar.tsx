import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts, Palette } from '@/constants/theme';

type Props = {
  uri: string | null;
  name: string;
  size: number;
  style?: StyleProp<ViewStyle>;
};

/** Photo de profil ronde ; sans photo, l'initiale sur fond rose. */
export function Avatar({ uri, name, size, style }: Props) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <View accessibilityLabel={name} style={[styles.base, styles.clip, shape, style]}>
        <Image source={{ uri }} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
      </View>
    );
  }
  return (
    <View accessibilityLabel={name} style={[styles.base, styles.initialWrap, shape, style]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Palette.cardBackground,
  },
  clip: {
    overflow: 'hidden',
  },
  initialWrap: {
    backgroundColor: Palette.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontWeight: '800',
  },
});
