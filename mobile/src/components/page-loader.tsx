import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Palette } from '@/constants/theme';

/**
 * Loader de page : spinner rose centré sur tout l'écran, par-dessus le contenu, en laissant
 * l'en-tête visible et les touches passer. À monter en dernier enfant de l'écran.
 */
export function PageLoader() {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      {/* iOS ne propose que small (20) et large (36) : on agrandit le small pour un entre-deux. */}
      <ActivityIndicator size="small" color={Palette.pink} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    transform: [{ scale: 1.4 }],
  },
});
