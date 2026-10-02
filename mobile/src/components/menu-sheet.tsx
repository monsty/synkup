import { BlurView } from 'expo-blur';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  Pressable as SheetPressable,
} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

const FADE_MS = 150;
const SLIDE_IN = { damping: 24, stiffness: 260, overshootClamping: true };
/** Glissement vers le bas au-delà duquel la feuille se ferme. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 700;

export type MenuItemKey = 'profile' | 'settings' | 'legal';

type MenuItem = {
  key: MenuItemKey;
  label: string;
  icon: SymbolViewProps['name'];
  fallback: string;
};

const ITEMS: MenuItem[] = [
  {
    key: 'profile',
    label: 'Mon profil',
    icon: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
    fallback: '☺',
  },
  {
    key: 'settings',
    label: 'Paramétrages',
    icon: { ios: 'gearshape', android: 'settings', web: 'settings' },
    fallback: '⚙',
  },
  {
    key: 'legal',
    label: 'Mentions légales',
    icon: { ios: 'doc.text', android: 'description', web: 'description' },
    fallback: '≡',
  },
];

type Props = {
  onSelect: (key: MenuItemKey) => void;
  onLogout: () => void;
  /** Appelé une fois le fondu de sortie terminé : le parent peut alors démonter la feuille. */
  onClose: () => void;
};

/**
 * Menu en feuille coulissante par le bas, rendue en calque (pas une route) : ouverture et
 * fermeture instantanées. Se ferme au tap sur le fond, au glissement vers le bas, ou au retour
 * Android. Le parent doit la monter avec une clé unique par ouverture.
 */
export function MenuSheet({ onSelect, onLogout, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [closing, setClosing] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);

  const backdrop = useSharedValue(0);
  const translateY = useSharedValue(600);
  const closed = useSharedValue(false);
  const unmounted = useSharedValue(false);

  useEffect(() => {
    backdrop.set(withTiming(1, { duration: FADE_MS }));
    return () => {
      unmounted.set(true);
    };
  }, [backdrop, unmounted]);

  // La feuille glisse depuis le bas dès que sa hauteur est connue.
  useEffect(() => {
    if (sheetHeight > 0) translateY.set(withSpring(0, SLIDE_IN));
  }, [sheetHeight, translateY]);

  const close = () => {
    if (closed.get()) return;
    closed.set(true);
    setClosing(true);
    backdrop.set(withTiming(0, { duration: FADE_MS }));
    translateY.set(
      withTiming(sheetHeight || 600, { duration: FADE_MS + 50 }, (finished) => {
        if (finished && !unmounted.get()) scheduleOnRN(onClose);
      })
    );
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = Gesture.Pan()
    .minDistance(6)
    .onUpdate((event) => {
      // Vers le haut, la feuille résiste ; vers le bas, elle suit le doigt.
      translateY.set(event.translationY > 0 ? event.translationY : event.translationY * 0.15);
    })
    .onEnd((event) => {
      if (translateY.get() > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(close);
        return;
      }
      translateY.set(withSpring(0, SLIDE_IN));
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
    opacity: interpolate(translateY.get(), [0, sheetHeight || 600], [1, 0.6], Extrapolation.CLAMP),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={closing ? 'none' : 'auto'}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView
          intensity={40}
          tint="light"
          blurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.frost]} />
      </Animated.View>

      {/* Tap sur le fond : ferme. */}
      <Pressable
        accessibilityLabel="Fermer le menu"
        onPress={close}
        style={StyleSheet.absoluteFill}
      />

      <GestureDetector gesture={pan}>
        <Animated.View
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, Spacing.three) + Spacing.two },
            sheetStyle,
          ]}>
          <View style={styles.handle} />

          <View style={styles.items}>
            {/* Pressable de Gesture Handler : un glissement commencé sur un bouton ferme quand même la feuille. */}
            {ITEMS.map((item, index) => (
              <SheetPressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => onSelect(item.key)}
                style={({ pressed }) => [
                  styles.item,
                  index < ITEMS.length - 1 && styles.itemDivider,
                  pressed && styles.itemPressed,
                ]}>
                <View style={styles.itemIcon}>
                  <SymbolView
                    name={item.icon}
                    size={20}
                    weight="bold"
                    tintColor={Palette.pink}
                    fallback={<Text style={styles.itemIconFallback}>{item.fallback}</Text>}
                  />
                </View>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  weight="heavy"
                  tintColor={Palette.textMuted}
                  fallback={<Text style={styles.itemChevronFallback}>›</Text>}
                />
              </SheetPressable>
            ))}
          </View>

          <SheetPressable
            accessibilityRole="button"
            onPress={onLogout}
            style={({ pressed }) => [styles.logout, pressed && styles.itemPressed]}>
            <SymbolView
              name={{
                ios: 'rectangle.portrait.and.arrow.right',
                android: 'logout',
                web: 'logout',
              }}
              size={18}
              weight="heavy"
              tintColor={Palette.pink}
              fallback={<Text style={styles.logoutFallback}>⇥</Text>}
            />
            <Text style={styles.logoutLabel}>Se déconnecter</Text>
          </SheetPressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  frost: {
    backgroundColor: 'rgba(244, 244, 247, 0.45)',
  },
  sheet: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    bottom: Spacing.two,
    borderRadius: Radii.card,
    backgroundColor: Palette.card,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surfaceStrong,
    marginBottom: Spacing.one,
  },
  items: {
    borderRadius: Spacing.four,
    backgroundColor: Palette.background,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 60,
    paddingHorizontal: Spacing.three,
  },
  itemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.surfaceStrong,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconFallback: {
    color: Palette.pink,
    fontSize: 18,
    fontWeight: '800',
  },
  itemLabel: {
    flex: 1,
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '700',
  },
  itemChevronFallback: {
    color: Palette.textMuted,
    fontSize: 18,
    fontWeight: '900',
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 56,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
  },
  logoutFallback: {
    color: Palette.pink,
    fontSize: 18,
    fontWeight: '900',
  },
  logoutLabel: {
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '800',
  },
});
