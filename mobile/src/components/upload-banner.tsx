import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAlbumUploads } from '@/hooks/use-upload-queue';
import { dismissFailedUploads, retryFailedUploads } from '@/services/upload-queue';

const FILL_DURATION_MS = 260;

/**
 * Bandeau sous l'en-tête de l'album pendant que des photos partent en arrière-plan :
 * avancement « 3 / 12 » avec une barre, puis « 12 photos envoyées » un instant. Si des
 * envois ont échoué, il reste avec la raison, « Réessayer » et « Ignorer ».
 */
export function UploadBanner({ albumId }: { albumId: string }) {
  const { active, done, failed, error } = useAlbumUploads(albumId);
  if (active === 0 && done === 0 && failed === 0) return null;

  const total = active + done;
  const uploading = active > 0;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, !uploading && failed > 0 && styles.iconError]}>
            {uploading ? (
              <ActivityIndicator size="small" color={Palette.pink} />
            ) : failed > 0 ? (
              <SymbolView
                name={{ ios: 'exclamationmark', android: 'priority_high', web: 'priority_high' }}
                size={16}
                weight="heavy"
                tintColor={Palette.onPhoto}
                fallback={<Text style={styles.iconFallbackOnDark}>!</Text>}
              />
            ) : (
              <SymbolView
                name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                size={16}
                weight="heavy"
                tintColor={Palette.pink}
                fallback={<Text style={styles.iconFallback}>✓</Text>}
              />
            )}
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>
              {uploading
                ? `Envoi des photos · ${done} / ${total}`
                : failed > 0
                  ? `${failed} photo${failed > 1 ? 's' : ''} n’${failed > 1 ? 'ont' : 'a'} pas pu être envoyée${failed > 1 ? 's' : ''}`
                  : `${done} photo${done > 1 ? 's' : ''} envoyée${done > 1 ? 's' : ''}`}
            </Text>
            {uploading && failed > 0 && (
              <Text style={styles.detail}>
                {failed} en échec, à réessayer une fois l’envoi terminé
              </Text>
            )}
            {!uploading && failed > 0 && error && <Text style={styles.detail}>{error}</Text>}
          </View>
        </View>

        {uploading && <ProgressBar ratio={total > 0 ? done / total : 0} />}

        {!uploading && failed > 0 && (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => dismissFailedUploads(albumId)}
              hitSlop={8}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Text style={styles.actionMuted}>Ignorer</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => retryFailedUploads(albumId)}
              hitSlop={8}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Text style={styles.actionPink}>Réessayer</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function ProgressBar({ ratio }: { ratio: number }) {
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: withTiming(ratio, { duration: FILL_DURATION_MS }) }],
  }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.two + Spacing.one,
    borderRadius: Radii.tile,
    backgroundColor: Palette.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconError: {
    backgroundColor: Palette.text,
  },
  iconFallback: {
    color: Palette.pink,
    fontWeight: '900',
  },
  iconFallbackOnDark: {
    color: Palette.onPhoto,
    fontWeight: '900',
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  detail: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  track: {
    height: 6,
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  action: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.one,
  },
  actionMuted: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '700',
  },
  actionPink: {
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
