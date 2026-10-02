import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { albumApi } from '@/services/album-api';
import { toDateKey } from '@/types/album';

const NAME_MAX = 40;

type Preset = { key: string; label: string; range: () => { start: Date; end: Date } };

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Raccourcis de période : un tap suffit dans la plupart des cas. */
const PRESETS: Preset[] = [
  {
    key: 'today',
    label: "Aujourd'hui",
    range: () => ({ start: startOfDay(new Date()), end: startOfDay(new Date()) }),
  },
  {
    key: 'weekend',
    label: 'Ce week-end',
    range: () => {
      const today = startOfDay(new Date());
      const day = today.getDay(); // 0 = dimanche, 6 = samedi
      // Samedi le plus proche : aujourd'hui si on y est, hier si on est dimanche, sinon le prochain.
      const saturday = day === 6 ? today : day === 0 ? addDays(today, -1) : addDays(today, 6 - day);
      return { start: saturday, end: addDays(saturday, 1) };
    },
  },
];

export default function NewAlbumScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<string | null>('today');
  const [start, setStart] = useState(() => startOfDay(new Date()));
  const [end, setEnd] = useState(() => startOfDay(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0 && trimmedName.length <= NAME_MAX && !saving;

  const applyPreset = (item: Preset) => {
    const range = item.range();
    setPreset(item.key);
    setStart(range.start);
    setEnd(range.end);
  };

  const changeStart = (date: Date) => {
    const day = startOfDay(date);
    setPreset(null);
    setStart(day);
    if (day > end) setEnd(day);
  };

  const changeEnd = (date: Date) => {
    setPreset(null);
    setEnd(startOfDay(date));
  };

  const create = async () => {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    try {
      const album = await albumApi.createAlbum({
        name: trimmedName,
        startDate: toDateKey(start),
        endDate: toDateKey(end),
      });
      // On remplace l'écran de création : retour arrière = liste des albums.
      router.replace({ pathname: '/album/[id]', params: { id: album.id } });
    } catch {
      setError("Impossible de créer l'album. Réessaie.");
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader left={<BackButton accessibilityLabel="Annuler" />} scrolled={scrolled} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.two, paddingBottom: insets.bottom + Spacing.six + Spacing.four },
        ]}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Nouvel album</Text>
          <Text style={styles.subtitle}>Un nom, une période, et c&apos;est parti</Text>
        </View>

        <TextField
          label="Nom de l'album"
          value={name}
          onChangeText={setName}
          placeholder="Week-end à Lisbonne"
          autoCapitalize="sentences"
          autoFocus
          maxLength={NAME_MAX + 4}
          returnKeyType="done"
          onSubmitEditing={create}
          error={trimmedName.length > NAME_MAX ? `${NAME_MAX} caractères maximum.` : null}
        />

        <View style={styles.section}>
          <Text style={styles.label}>Période</Text>
          <View style={styles.chips}>
            {PRESETS.map((item) => {
              const selected = preset === item.key;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => applyPreset(item)}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.dates}>
            <DateField label="Du" value={start} onChange={changeStart} />
            <DateField label="Au" value={end} onChange={changeEnd} minimumDate={start} />
          </View>
          <Text style={styles.hint}>
            Seules les photos prises pendant cette période seront proposées au tri.
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Créer l'album"
          disabled={!canCreate}
          onPress={create}
          style={({ pressed }) => [
            styles.createButton,
            !canCreate && styles.createButtonDisabled,
            pressed && styles.pressed,
          ]}>
          {saving ? (
            <ActivityIndicator size="small" color={Palette.onPhoto} />
          ) : (
            <Text style={styles.createLabel}>Créer l&apos;album</Text>
          )}
        </Pressable>
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
  section: {
    gap: Spacing.two,
  },
  label: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: Palette.pink,
  },
  chipText: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: Palette.onPhoto,
  },
  dates: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  hint: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    paddingHorizontal: Spacing.one,
  },
  error: {
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  createButton: {
    height: 56,
    borderRadius: Radii.pill,
    backgroundColor: Palette.pink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  createButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  createLabel: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
