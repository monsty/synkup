import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { LANGUAGES } from '@/constants/languages';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { getSettingsSync, settingsApi, type Language } from '@/services/settings-api';

export default function LanguageScreen() {
  const insets = useSafeAreaInsets();
  // La liste vit dans l'app et le réglage est local : aucun chargement, lecture synchrone.
  const [current, setCurrent] = useState<Language>(() => getSettingsSync().language);
  const [scrolled, setScrolled] = useState(false);

  const select = async (code: Language) => {
    setCurrent(code);
    await settingsApi.updateLanguage(code);
    // Choix fait : on revient aux paramètres.
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader left={<BackButton />} scrolled={scrolled} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.two, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Langue</Text>
          <Text style={styles.subtitle}>D&apos;autres langues arrivent bientôt</Text>
        </View>

        <View style={styles.card}>
          {LANGUAGES.map((language, index) => {
            const selected = language.code === current;
            return (
              <Pressable
                key={language.code}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !language.available }}
                accessibilityLabel={`${language.nativeName}${language.available ? '' : ', bientôt disponible'}`}
                disabled={!language.available}
                onPress={() => select(language.code)}
                style={({ pressed }) => [
                  styles.row,
                  index < LANGUAGES.length - 1 && styles.rowDivider,
                  !language.available && styles.rowDisabled,
                  pressed && styles.rowPressed,
                ]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{language.nativeName}</Text>
                  {language.localizedName !== language.nativeName && (
                    <Text style={styles.rowDetail}>{language.localizedName}</Text>
                  )}
                </View>
                {selected ? (
                  <SymbolView
                    name={{
                      ios: 'checkmark.circle.fill',
                      android: 'check_circle',
                      web: 'check_circle',
                    }}
                    size={22}
                    weight="bold"
                    tintColor={Palette.pink}
                    fallback={<Text style={styles.checkFallback}>✓</Text>}
                  />
                ) : !language.available ? (
                  <View style={styles.soonPill}>
                    <Text style={styles.soonText}>Bientôt</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.four,
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    borderRadius: Radii.tile,
    backgroundColor: Palette.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 60,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.surfaceStrong,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowPressed: {
    backgroundColor: Palette.background,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '700',
  },
  rowDetail: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
  },
  checkFallback: {
    color: Palette.pink,
    fontSize: 18,
    fontWeight: '900',
  },
  soonPill: {
    height: 26,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 12,
    fontWeight: '800',
  },
});
