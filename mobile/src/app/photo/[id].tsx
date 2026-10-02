import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { albumApi, type PhotoContext } from '@/services/album-api';
import { formatPhotoDate } from '@/types/album';

const HEADER_HEIGHT = 40 + Spacing.two;
const CAPTION_HEIGHT = 40 + Spacing.three;

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const DISMISS_DURATION_MS = 180;

const SLIDE_DISTANCE = 80;
const SLIDE_VELOCITY = 600;
const SLIDE_OUT_DURATION_MS = 150;
const SLIDE_IN_DURATION_MS = 180;
/** Résistance quand on tire vers une voisine qui n'existe pas. */
const EDGE_RESISTANCE = 0.3;

/** Axe verrouillé du glissement quand on n'est pas zoomé. */
const AXIS_NONE = 0;
const AXIS_HORIZONTAL = 1;
const AXIS_VERTICAL = 2;

type Direction = -1 | 1;

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [context, setContext] = useState<PhotoContext | null>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const photo = context?.photo ?? null;

  const load = useCallback((photoId: string) => {
    let active = true;
    albumApi.getPhotoContext(photoId).then((result) => {
      if (!active || !result) return;
      setContext(result);
      // Précharge les voisines pour que le glissement soit instantané.
      const neighbours = [result.previous?.uri, result.next?.uri].filter(
        (uri): uri is string => !!uri
      );
      if (neighbours.length) Image.prefetch(neighbours);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(id), [id, load]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Taille de la carte : largeur max, hauteur bornée par la place disponible, ratio de la photo.
  const maxWidth = width - Spacing.three * 2;
  const maxHeight =
    height - insets.top - insets.bottom - HEADER_HEIGHT - CAPTION_HEIGHT - Spacing.four * 2;
  const ratio = photo ? photo.width / photo.height : 1;
  const cardWidth = Math.min(maxWidth, maxHeight * ratio);
  const cardHeight = cardWidth / ratio;

  // Zoom et déplacement dans la photo.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPanX = useSharedValue(0);
  const savedPanY = useSharedValue(0);
  // Glissements quand on n'est pas zoomé : vertical pour fermer, horizontal pour naviguer.
  const dismissY = useSharedValue(0);
  const slideX = useSharedValue(0);
  const axis = useSharedValue(AXIS_NONE);
  // Sens d'entrée de la prochaine photo (0 = aucun), consommé une fois qu'elle est rendue.
  const enterFrom = useSharedValue(0);

  const hasPrevious = !!context?.previous;
  const hasNext = !!context?.next;

  /** Appelé depuis le thread UI une fois la carte sortie de l'écran. */
  const goTo = (direction: Direction) => {
    const target = direction === 1 ? context?.next : context?.previous;
    if (target) load(target.id);
  };

  // La nouvelle photo entre par le côté opposé à la sortie de l'ancienne.
  useEffect(() => {
    const direction = enterFrom.get();
    if (!direction) return;
    enterFrom.set(0);
    slideX.set(direction * width);
    slideX.set(withTiming(0, { duration: SLIDE_IN_DURATION_MS }));
  }, [photo?.id, enterFrom, slideX, width]);

  const resetZoom = () => {
    'worklet';
    scale.set(withSpring(1));
    savedScale.set(1);
    panX.set(withSpring(0));
    panY.set(withSpring(0));
    savedPanX.set(0);
    savedPanY.set(0);
  };

  /** Ramène le déplacement dans les bords de la photo zoomée. */
  const clampPan = (value: number, size: number, currentScale: number) => {
    'worklet';
    const max = Math.max(0, (size * currentScale - size) / 2);
    return Math.min(max, Math.max(-max, value));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.set(Math.min(MAX_SCALE * 1.5, Math.max(0.5, savedScale.get() * event.scale)));
    })
    .onEnd(() => {
      const current = scale.get();
      if (current <= MIN_SCALE) {
        resetZoom();
        return;
      }
      const clamped = Math.min(MAX_SCALE, current);
      const x = clampPan(panX.get(), cardWidth, clamped);
      const y = clampPan(panY.get(), cardHeight, clamped);
      scale.set(withSpring(clamped));
      savedScale.set(clamped);
      panX.set(withSpring(x));
      panY.set(withSpring(y));
      savedPanX.set(x);
      savedPanY.set(y);
    });

  const pan = Gesture.Pan()
    .minDistance(8)
    .onUpdate((event) => {
      if (savedScale.get() > MIN_SCALE) {
        panX.set(savedPanX.get() + event.translationX);
        panY.set(savedPanY.get() + event.translationY);
        return;
      }
      if (axis.get() === AXIS_NONE) {
        axis.set(
          Math.abs(event.translationX) > Math.abs(event.translationY)
            ? AXIS_HORIZONTAL
            : AXIS_VERTICAL
        );
      }
      if (axis.get() === AXIS_HORIZONTAL) {
        const towardsNext = event.translationX < 0;
        const blocked = towardsNext ? !hasNext : !hasPrevious;
        slideX.set(blocked ? event.translationX * EDGE_RESISTANCE : event.translationX);
        return;
      }
      dismissY.set(event.translationY);
    })
    .onEnd((event) => {
      if (savedScale.get() > MIN_SCALE) {
        const currentScale = savedScale.get();
        const x = clampPan(panX.get(), cardWidth, currentScale);
        const y = clampPan(panY.get(), cardHeight, currentScale);
        panX.set(withSpring(x));
        panY.set(withSpring(y));
        savedPanX.set(x);
        savedPanY.set(y);
        return;
      }

      const lockedAxis = axis.get();
      axis.set(AXIS_NONE);

      if (lockedAxis === AXIS_HORIZONTAL) {
        const direction: Direction = (slideX.get() || event.velocityX) < 0 ? 1 : -1;
        const available = direction === 1 ? hasNext : hasPrevious;
        const farEnough = Math.abs(slideX.get()) > SLIDE_DISTANCE;
        const fastEnough = Math.abs(event.velocityX) > SLIDE_VELOCITY;
        if (available && (farEnough || fastEnough)) {
          enterFrom.set(direction);
          slideX.set(
            withTiming(-direction * width, { duration: SLIDE_OUT_DURATION_MS }, (finished) => {
              if (finished) scheduleOnRN(goTo, direction);
            })
          );
          return;
        }
        slideX.set(withSpring(0));
        return;
      }

      const farEnough = Math.abs(dismissY.get()) > DISMISS_DISTANCE;
      const fastEnough = Math.abs(event.velocityY) > DISMISS_VELOCITY;
      if (farEnough || fastEnough) {
        const direction = (dismissY.get() || event.velocityY) > 0 ? 1 : -1;
        // On ferme tout de suite : le fondu de la modale couvre la fin de l'envol.
        dismissY.set(withTiming(direction * height, { duration: DISMISS_DURATION_MS }));
        scheduleOnRN(close);
        return;
      }
      dismissY.set(withSpring(0));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.get() > MIN_SCALE) {
        resetZoom();
        return;
      }
      scale.set(withSpring(DOUBLE_TAP_SCALE));
      savedScale.set(DOUBLE_TAP_SCALE);
    });

  const gestures = Gesture.Simultaneous(pinch, pan, doubleTap);

  const cardStyle = useAnimatedStyle(() => {
    const drag = Math.abs(dismissY.get());
    const shrink = interpolate(drag, [0, height], [1, 0.8], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: slideX.get() },
        { translateY: dismissY.get() },
        { scale: shrink },
        { translateX: panX.get() },
        { translateY: panY.get() },
        { scale: scale.get() },
      ],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(dismissY.get()), [0, height * 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView
          intensity={70}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.frost]} />
      </Animated.View>

      {/* Le fond est un Pressable parent : un tap hors des enfants interactifs ferme le visualiseur. */}
      <Pressable
        accessibilityLabel="Fermer"
        onPress={close}
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, Spacing.three) },
        ]}>
        <Animated.View style={[styles.header, backdropStyle]}>
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
          {context && (
            <View style={styles.pill}>
              <Text style={styles.pillValue}>{context.index + 1}</Text>
              <Text style={styles.pillUnit}>/ {context.count}</Text>
            </View>
          )}
        </Animated.View>

        <View style={styles.body}>
          {photo && (
            <GestureDetector gesture={gestures}>
              <Animated.View
                entering={ZoomIn.duration(220)}
                style={[styles.card, { width: cardWidth, height: cardHeight }, cardStyle]}>
                {/* Pressable neutre : un simple tap sur la photo ne doit pas fermer. */}
                <Pressable style={StyleSheet.absoluteFill}>
                  <Image
                    source={{ uri: photo.uri }}
                    contentFit="cover"
                    transition={120}
                    cachePolicy="memory-disk"
                    style={StyleSheet.absoluteFill}
                  />
                </Pressable>
              </Animated.View>
            </GestureDetector>
          )}
        </View>

        <Animated.View style={[styles.captionRow, backdropStyle]}>
          {photo && (
            <Animated.View entering={FadeIn.duration(220)} style={styles.caption}>
              <Text style={styles.captionAuthor}>{photo.authorName}</Text>
              <Text style={styles.captionText}>{formatPhotoDate(photo.takenAt)}</Text>
            </Animated.View>
          )}
        </Animated.View>
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
    height: HEADER_HEIGHT,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
  },
  pillValue: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pillUnit: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  card: {
    borderRadius: Radii.card,
    overflow: 'hidden',
    backgroundColor: Palette.cardBackground,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  captionRow: {
    height: CAPTION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
  },
  captionAuthor: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '800',
  },
  captionText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
