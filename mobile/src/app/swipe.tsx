import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedCounter } from '@/components/animated-counter';
import { SwipeDeck } from '@/components/swipe-deck';
import { Fonts, Spacing, Palette } from '@/constants/theme';
import { useSwipeSession } from '@/hooks/use-swipe-session';
import { formatAlbumRange } from '@/types/album';

export default function SwipeScreen() {
  const {
    album,
    status,
    error,
    candidates,
    decide,
    uploadsInFlight,
    canAskPermissionAgain,
    requestPermission,
  } = useSwipeSession();

  // Ouvert via deep link, l'écran peut être seul dans la pile : on retombe alors sur l'album.
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const remaining = candidates.length;
  // Insets lus depuis le provider racine : avec une modale transparente, un SafeAreaView local
  // peut rendre une première frame sans inset pendant l'animation d'ouverture.
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <BlurView
        intensity={70}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.frost]} />
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, Spacing.three) },
        ]}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Fermer"
            onPress={close}
            hitSlop={12}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={16}
              weight="heavy"
              tintColor={Palette.text}
              fallback={<Text style={styles.closeFallback}>✕</Text>}
            />
          </Pressable>

          <Text style={styles.brand}>Synkup</Text>

          {/* La pilule n'apparaît qu'une fois le nombre connu, avec un fondu. */}
          {status === 'ready' && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.counterPill}>
              {uploadsInFlight > 0 && <ActivityIndicator size="small" color={Palette.pink} />}
              <AnimatedCounter value={remaining} style={styles.counterValue} />
              <Text style={styles.counterUnit}>à trier</Text>
            </Animated.View>
          )}
        </View>

        {/* Toujours rendue, même vide, pour que le contenu ne saute pas quand l'album arrive. */}
        <Text style={styles.period}>{album ? formatAlbumRange(album) : ' '}</Text>

        {status === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator color={Palette.pink} />
            <Text style={styles.body}>Recherche des photos…</Text>
          </View>
        )}

        {status === 'unsupported' && (
          <Message
            title="Sur mobile uniquement"
            body="Le tri des photos a besoin de la galerie du téléphone."
            actionLabel="Fermer"
            onAction={close}
          />
        )}

        {status === 'permission-denied' && (
          <Message
            title="Accès aux photos refusé"
            body="Autorise l'accès à ta galerie pour retrouver les photos prises pendant l'album."
            actionLabel={canAskPermissionAgain ? 'Autoriser' : 'Ouvrir les réglages'}
            onAction={() => (canAskPermissionAgain ? requestPermission() : Linking.openSettings())}
          />
        )}

        {status === 'error' && (
          <Message
            title="Oups"
            body={error ?? 'Une erreur est survenue.'}
            actionLabel="Fermer"
            onAction={close}
          />
        )}

        {status === 'ready' && remaining === 0 && (
          <Message
            title="Tout est trié 🎉"
            body={
              album
                ? `Aucune nouvelle photo prise entre le ${formatAlbumRange(album).replace(' → ', ' et le ')}.`
                : 'Aucune nouvelle photo.'
            }
            actionLabel="Retour à l'album"
            onAction={close}
          />
        )}

        {status === 'ready' && remaining > 0 && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
            <SwipeDeck photos={candidates} onDecide={decide} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

type MessageProps = {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
};

function Message({ title, body, actionLabel, onAction }: MessageProps) {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        onPress={onAction}
        style={({ pressed }) => [styles.messageButton, pressed && styles.pressed]}>
        <Text style={styles.messageButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  frost: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeFallback: {
    color: Palette.text,
    fontWeight: '900',
  },
  brand: {
    flex: 1,
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    backgroundColor: Palette.surface,
  },
  counterValue: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  counterUnit: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  period: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
  },
  messageButton: {
    marginTop: Spacing.two,
    height: 56,
    paddingHorizontal: Spacing.five,
    borderRadius: 28,
    backgroundColor: Palette.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButtonText: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
