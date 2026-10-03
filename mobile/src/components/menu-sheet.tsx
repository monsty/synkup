import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable as SheetPressable } from 'react-native-gesture-handler';

import { BottomSheet } from '@/components/bottom-sheet';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

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
    label: 'Paramètres',
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

/** Menu principal, dans une `BottomSheet` : profil, paramètres, mentions légales, déconnexion. */
export function MenuSheet({ onSelect, onLogout, onClose }: Props) {
  return (
    <BottomSheet dismissLabel="Fermer le menu" onClose={onClose}>
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
