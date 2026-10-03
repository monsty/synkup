import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Fonts, Spacing, Palette } from '@/constants/theme';
import { formatPhotoDate, type GalleryPhoto, type ReviewDecision } from '@/types/album';

const SWIPE_THRESHOLD_RATIO = 0.3;
const SWIPE_VELOCITY_THRESHOLD = 900;
const FLY_OUT_DURATION_MS = 260;
const MAX_ROTATION_DEG = 14;
const BACK_CARD_SCALE = 0.92;
const BACK_CARD_OFFSET_Y = 18;
const CARD_RADIUS = 40;
/**
 * Cartes montées derrière le paquet, invisibles : leurs photos se chargent et se décodent à
 * l'avance (à la taille de la carte), pour que les swipes rapides n'attendent jamais une image.
 */
const PRELOAD_AHEAD = 4;

/** Dessus (gestes, tampons), derrière (visible, réduite), ou préchargée (invisible). */
type CardRole = 'top' | 'next' | 'hidden';

type SwipeCardHandle = {
  swipe: (decision: ReviewDecision) => void;
};

type SwipeCardProps = {
  photo: GalleryPhoto;
  role: CardRole;
  /** Position normalisée de la carte du dessus : -1 (gauche) … 0 … 1 (droite). */
  progress: SharedValue<number>;
  onSwiped: (photo: GalleryPhoto, decision: ReviewDecision) => void;
  ref?: Ref<SwipeCardHandle>;
};

function SwipeCard({ photo, role, progress, onSwiped, ref }: SwipeCardProps) {
  const isTop = role === 'top';
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const flyOut = (direction: 1 | -1) => {
    'worklet';
    const decision: ReviewDecision = direction === 1 ? 'sent' : 'skipped';
    progress.set(withTiming(direction, { duration: FLY_OUT_DURATION_MS }));
    translateX.set(
      withTiming(direction * width * 1.5, { duration: FLY_OUT_DURATION_MS }, (finished) => {
        if (finished) scheduleOnRN(onSwiped, photo, decision);
      })
    );
  };

  useImperativeHandle(ref, () => ({
    swipe: (decision) => flyOut(decision === 'sent' ? 1 : -1),
  }));

  const pan = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      translateX.set(event.translationX);
      translateY.set(event.translationY * 0.35);
      progress.set(event.translationX / width);
    })
    .onEnd((event) => {
      const passedDistance = Math.abs(event.translationX) > width * SWIPE_THRESHOLD_RATIO;
      const passedVelocity = Math.abs(event.velocityX) > SWIPE_VELOCITY_THRESHOLD;
      if (passedDistance || passedVelocity) {
        const direction = (event.translationX || event.velocityX) > 0 ? 1 : -1;
        flyOut(direction);
        return;
      }
      translateX.set(withSpring(0));
      translateY.set(withSpring(0));
      progress.set(withSpring(0));
    });

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      const amount = Math.min(Math.abs(progress.get()), 1);
      const scale = interpolate(amount, [0, 1], [BACK_CARD_SCALE, 1], Extrapolation.CLAMP);
      const offsetY = interpolate(amount, [0, 1], [BACK_CARD_OFFSET_Y, 0], Extrapolation.CLAMP);
      return { transform: [{ translateY: offsetY }, { scale }] };
    }
    const rotate = interpolate(
      translateX.get(),
      [-width, 0, width],
      [-MAX_ROTATION_DEG, 0, MAX_ROTATION_DEG],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.get() },
        { translateY: translateY.get() },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const sendStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [0, width * 0.2], [0, 1], Extrapolation.CLAMP),
  }));
  const skipStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [-width * 0.2, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        pointerEvents={role === 'hidden' ? 'none' : 'auto'}
        style={[styles.card, cardStyle, role === 'hidden' && styles.hiddenCard]}>
        <Image
          source={{ uri: photo.id }}
          recyclingKey={photo.id}
          priority={role === 'hidden' ? 'low' : 'high'}
          contentFit="cover"
          transition={role === 'hidden' ? 0 : 120}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.captionWrap}>
          <View style={styles.caption}>
            <Text style={styles.captionText}>{formatPhotoDate(photo.creationTime)}</Text>
          </View>
        </View>

        {isTop && (
          <>
            <Animated.View style={[styles.stamp, styles.stampSend, sendStampStyle]}>
              <Text style={[styles.stampText, { color: Palette.onPhoto }]}>ENVOYER</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampSkip, skipStampStyle]}>
              <Text style={[styles.stampText, { color: Palette.onPhoto }]}>PASSER</Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

type SwipeDeckProps = {
  /** Photos restantes. La première est la carte du dessus. */
  photos: GalleryPhoto[];
  onDecide: (photo: GalleryPhoto, decision: ReviewDecision) => void;
};

export function SwipeDeck({ photos, onDecide }: SwipeDeckProps) {
  const progress = useSharedValue(0);
  const topCardRef = useRef<SwipeCardHandle>(null);

  const top = photos[0];
  // Du fond vers le dessus : les cartes préchargées, puis celle de derrière, puis celle du dessus.
  // Les clés sont stables : une carte promue garde son instance, donc son image déjà décodée.
  const stack = photos.slice(0, 2 + PRELOAD_AHEAD);
  const roleOf = (index: number): CardRole => (index === 0 ? 'top' : index === 1 ? 'next' : 'hidden');

  // On remet la progression à zéro seulement une fois la nouvelle carte du dessus en place.
  // La faire avant provoquait un zoom visible : l'ancienne carte de derrière repassait
  // à l'échelle réduite pendant une frame avant d'être promue.
  useEffect(() => {
    progress.set(0);
  }, [progress, top?.id]);

  const handleSwiped = (photo: GalleryPhoto, decision: ReviewDecision) => {
    onDecide(photo, decision);
  };

  return (
    <View style={styles.deck}>
      <View style={styles.cards}>
        {stack
          .map((photo, index) => ({ photo, role: roleOf(index) }))
          .reverse()
          .map(({ photo, role }) => (
            <SwipeCard
              key={photo.id}
              photo={photo}
              role={role}
              progress={progress}
              onSwiped={handleSwiped}
              ref={role === 'top' ? topCardRef : undefined}
            />
          ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Passer cette photo"
          onPress={() => topCardRef.current?.swipe('skipped')}
          style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            size={24}
            weight="heavy"
            tintColor={Palette.pink}
            fallback={<Text style={styles.skipFallback}>✕</Text>}
          />
        </Pressable>

        <Pressable
          accessibilityLabel="Envoyer cette photo dans l'album"
          onPress={() => topCardRef.current?.swipe('sent')}
          style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
          <SymbolView
            name={{
              ios: 'icloud.and.arrow.up',
              android: 'cloud_upload',
              web: 'cloud_upload',
            }}
            size={30}
            weight="semibold"
            tintColor={Palette.onPhoto}
            fallback={<Text style={styles.sendFallback}>↑</Text>}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    flex: 1,
    gap: Spacing.four,
  },
  cards: {
    flex: 1,
    marginHorizontal: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  hiddenCard: {
    opacity: 0,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: Palette.cardBackground,
  },
  captionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    padding: Spacing.four,
  },
  caption: {
    backgroundColor: 'rgba(20, 20, 26, 0.6)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  captionText: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  stamp: {
    position: 'absolute',
    top: Spacing.five,
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  stampSend: {
    left: Spacing.four,
    backgroundColor: Palette.pink,
    transform: [{ rotate: '-12deg' }],
  },
  stampSkip: {
    right: Spacing.four,
    backgroundColor: Palette.text,
    transform: [{ rotate: '12deg' }],
  },
  stampText: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  skipButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Palette.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipFallback: {
    color: Palette.pink,
    fontSize: 26,
    fontWeight: '900',
  },
  /** Rond rose, un peu plus grand que « passer » : l'action principale, icône seule. */
  sendButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Palette.pink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sendFallback: {
    color: Palette.onPhoto,
    fontSize: 24,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});
