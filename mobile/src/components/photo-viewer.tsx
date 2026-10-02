import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { formatPhotoDate, type AlbumPhoto } from '@/types/album';

const HEADER_HEIGHT = 40 + Spacing.two;
const CAPTION_HEIGHT = 40 + Spacing.three;

/** Fondu d'ouverture et de fermeture du calque : court, pour rester réactif. */
const OVERLAY_FADE_MS = 120;

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const DISMISS_DURATION_MS = 180;

const SLIDE_DISTANCE = 80;
const SLIDE_VELOCITY = 600;
const SLIDE_OUT_DURATION_MS = 150;
const SLIDE_IN_DURATION_MS = 180;
/** Résistance quand on tire vers une voisine qui n'existe pas. */
const EDGE_RESISTANCE = 0.3;

/** Largeur de la zone du ✕ dans l'en-tête, marge de toucher comprise. */
const CLOSE_ZONE_RIGHT = Spacing.three + 40 + 12;

/** Axe verrouillé du glissement. */
const AXIS_NONE = 0;
const AXIS_HORIZONTAL = 1;
const AXIS_VERTICAL = 2;

type Direction = -1 | 1;

type Props = {
  photos: AlbumPhoto[];
  initialIndex: number;
  /** Appelé une fois le fondu de sortie terminé : le parent peut alors démonter le calque. */
  onClose: () => void;
};

/**
 * Visualiseur plein écran rendu en calque par-dessus l'écran appelant, sans navigation :
 * l'ouverture et la fermeture sont un simple changement d'état, donc instantanées.
 * Dès la demande de fermeture, le calque laisse passer les touches : on peut rouvrir une
 * autre photo pendant son fondu de sortie. Le parent doit le monter avec une clé unique
 * par ouverture.
 */
export function PhotoViewer({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [closing, setClosing] = useState(false);
  const overlayOpacity = useSharedValue(1);
  // Si le parent démonte avant la fin du fondu (nouvelle ouverture), on n'appelle pas onClose.
  const unmounted = useSharedValue(false);
  useEffect(
    () => () => {
      unmounted.set(true);
    },
    [unmounted]
  );
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const photo = photos[index] ?? null;
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;

  // Idempotent : ✕, tap sur le fond et glissement peuvent tous le déclencher.
  const closed = useSharedValue(false);
  const close = () => {
    if (closed.get()) return;
    closed.set(true);
    setClosing(true);
    overlayOpacity.set(
      withTiming(0, { duration: OVERLAY_FADE_MS }, (finished) => {
        if (finished && !unmounted.get()) scheduleOnRN(onClose);
      })
    );
  };

  // Bouton retour Android : ferme le visualiseur au lieu de quitter l'écran.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Précharge les voisines pour que le glissement soit instantané.
  useEffect(() => {
    const neighbours = [photos[index - 1]?.uri, photos[index + 1]?.uri].filter(
      (uri): uri is string => !!uri
    );
    if (neighbours.length) Image.prefetch(neighbours);
  }, [photos, index]);

  // Taille de la carte : largeur max, hauteur bornée par la place disponible, ratio de la photo.
  const maxWidth = width - Spacing.three * 2;
  const maxHeight =
    height - insets.top - insets.bottom - HEADER_HEIGHT - CAPTION_HEIGHT - Spacing.four * 2;
  const ratio = photo ? photo.width / photo.height : 1;
  const cardWidth = Math.min(maxWidth, maxHeight * ratio);
  const cardHeight = cardWidth / ratio;

  // Glissements de la carte : vertical pour fermer, horizontal pour naviguer.
  const dismissY = useSharedValue(0);
  const slideX = useSharedValue(0);
  const axis = useSharedValue(AXIS_NONE);
  // Centre de la carte dans le repère du détecteur de gestes (mesuré sur la zone centrale).
  const centerX = useSharedValue(width / 2);
  const centerY = useSharedValue(height / 2);

  /** Appelé depuis le thread UI une fois la carte sortie de l'écran. */
  const goTo = (direction: Direction) => {
    const next = index + direction;
    if (next < 0 || next >= photos.length) return;
    // La nouvelle photo entre par le côté opposé à la sortie de l'ancienne.
    slideX.set(direction * width);
    slideX.set(withTiming(0, { duration: SLIDE_IN_DURATION_MS }));
    setIndex(next);
  };

  const pan = Gesture.Pan()
    .minDistance(8)
    .onUpdate((event) => {
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
      const lockedAxis = axis.get();
      axis.set(AXIS_NONE);

      if (lockedAxis === AXIS_HORIZONTAL) {
        const direction: Direction = (slideX.get() || event.velocityX) < 0 ? 1 : -1;
        const available = direction === 1 ? hasNext : hasPrevious;
        const farEnough = Math.abs(slideX.get()) > SLIDE_DISTANCE;
        const fastEnough = Math.abs(event.velocityX) > SLIDE_VELOCITY;
        if (available && (farEnough || fastEnough)) {
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
        // On ferme tout de suite : le fondu du calque couvre la fin de l'envol.
        dismissY.set(withTiming(direction * height, { duration: DISMISS_DURATION_MS }));
        scheduleOnRN(close);
        return;
      }
      dismissY.set(withSpring(0));
    });

  /**
   * Tap simple : sur le ✕ ou hors de la photo, ferme ; sur la photo, rien. Il échoue dès que
   * le doigt bouge, donc un glissement commencé à côté de la photo ne ferme jamais.
   */
  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((event) => {
      if (event.y < insets.top + HEADER_HEIGHT) {
        if (event.x <= CLOSE_ZONE_RIGHT) scheduleOnRN(close);
        return;
      }
      const onCard =
        Math.abs(event.x - centerX.get()) <= cardWidth / 2 &&
        Math.abs(event.y - centerY.get()) <= cardHeight / 2;
      if (!onCard) scheduleOnRN(close);
    });

  // Les gestes couvrent tout l'écran : on peut glisser à côté d'une petite photo.
  const gestures = Gesture.Race(pan, tap);

  const cardStyle = useAnimatedStyle(() => {
    const drag = Math.abs(dismissY.get());
    const shrink = interpolate(drag, [0, height], [1, 0.8], Extrapolation.CLAMP);
    return {
      transform: [{ translateX: slideX.get() }, { translateY: dismissY.get() }, { scale: shrink }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(dismissY.get()), [0, height * 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.get() }));

  return (
    <Animated.View
      entering={FadeIn.duration(OVERLAY_FADE_MS)}
      pointerEvents={closing ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, overlayStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView
          intensity={70}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.frost]} />
      </Animated.View>

      {/* Les gestes couvrent tout l'écran. Le ✕ est géré par le tap (qui annule les boutons natifs). */}
      <GestureDetector gesture={gestures}>
        <View
          style={[
            styles.container,
            { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, Spacing.three) },
          ]}>
          <Animated.View style={[styles.header, backdropStyle]}>
            <View style={styles.closeButton}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={16}
                weight="heavy"
                tintColor={Palette.text}
                fallback={<Text style={styles.closeFallback}>✕</Text>}
              />
            </View>
            <Text style={styles.brand}>Synkup</Text>
            <View style={styles.pill}>
              <Text style={styles.pillValue}>{index + 1}</Text>
              <Text style={styles.pillUnit}>/ {photos.length}</Text>
            </View>
          </Animated.View>

          <View
            style={styles.body}
            onLayout={(event) => {
              // Enfant direct du conteneur du détecteur : même repère que les événements.
              const { x, y, width: w, height: h } = event.nativeEvent.layout;
              centerX.set(x + w / 2);
              centerY.set(y + h / 2);
            }}>
            {photo && (
              <Animated.View
                entering={ZoomIn.duration(180)}
                style={[styles.card, { width: cardWidth, height: cardHeight }, cardStyle]}>
                <Image
                  source={{ uri: photo.uri }}
                  contentFit="cover"
                  transition={100}
                  cachePolicy="memory-disk"
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}
          </View>

          <Animated.View style={[styles.captionRow, backdropStyle]}>
            {photo && (
              <View style={styles.caption}>
                <Text style={styles.captionAuthor}>{photo.authorName}</Text>
                <Text style={styles.captionText}>{formatPhotoDate(photo.takenAt)}</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </GestureDetector>
    </Animated.View>
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
  /** Étiquette d'info : pas de fond, pour ne pas ressembler aux boutons ronds gris. */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 40,
    paddingHorizontal: Spacing.one,
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
});
