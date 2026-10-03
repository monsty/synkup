import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { PageLoader } from '@/components/page-loader';
import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useExpiredUrlRetry } from '@/hooks/use-expired-url-retry';
import { useAlbumQuery, useDeleteAlbum, useUpdateAlbum } from '@/queries/albums';
import { pickSingleImage } from '@/services/photo-picker';
import { canEditAlbum, getAlbumRange, ROLE_LABEL, toDateKey, type Album } from '@/types/album';

const NAME_MAX = 40;
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export default function ManageAlbumScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const insets = useSafeAreaInsets();
  const { data: album, isPending, isError } = useAlbumQuery(albumId);
  const status = isPending ? 'loading' : isError || !album ? 'error' : 'ready';
  const [scrolled, setScrolled] = useState(false);

  return (
    <View style={styles.container}>
      <ScreenHeader
        left={<BackButton accessibilityLabel="Retour à l'album" />}
        scrolled={scrolled}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          // Juste la zone sûre : le clavier est géré par l'ajustement automatique des insets.
          { paddingTop: Spacing.two, paddingBottom: insets.bottom + Spacing.two },
        ]}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Gérer l&apos;album</Text>
          <Text style={styles.subtitle}>
            {album ? `Tu es ${ROLE_LABEL[album.myRole].toLowerCase()} de cet album` : ' '}
          </Text>
        </View>

        {status === 'error' && (
          <Text style={styles.errorText}>Impossible de charger l&apos;album.</Text>
        )}

        {/* Réservé au propriétaire ; un membre arrivé ici par un lien ne voit qu'un message. */}
        {album && !canEditAlbum(album.myRole) && (
          <Text style={styles.errorText}>Seul le propriétaire peut gérer cet album.</Text>
        )}
        {album && canEditAlbum(album.myRole) && (
          <>
            <CoverSection album={album} />
            <InfoSection album={album} />
            <DeleteAlbumLink album={album} />
          </>
        )}
      </ScrollView>
      {status === 'loading' && <PageLoader />}
    </View>
  );
}

type SectionProps = { album: Album };

/** Nom et période, modifiables par le propriétaire. */
function InfoSection({ album }: SectionProps) {
  const update = useUpdateAlbum(album.id);
  const editable = canEditAlbum(album.myRole);
  const range = getAlbumRange(album);
  const [name, setName] = useState(album.name);
  const [start, setStart] = useState(() => startOfDay(range.start));
  const [end, setEnd] = useState(() => startOfDay(range.end));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const trimmed = name.trim();
  const dirty =
    trimmed !== album.name ||
    toDateKey(start) !== album.startDate ||
    toDateKey(end) !== album.endDate;
  const valid = trimmed.length > 0 && trimmed.length <= NAME_MAX;

  const save = async () => {
    if (!dirty || !valid || saving) return;
    setSaving(true);
    try {
      await update.mutateAsync({
        name: trimmed,
        startDate: toDateKey(start),
        endDate: toDateKey(end),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Infos</Text>
      <TextField
        label="Nom de l'album"
        value={name}
        onChangeText={setName}
        editable={editable}
        maxLength={NAME_MAX + 4}
        returnKeyType="done"
        onSubmitEditing={save}
        error={trimmed.length > NAME_MAX ? `${NAME_MAX} caractères maximum.` : null}
        hint={editable ? undefined : 'Seul le propriétaire peut modifier.'}
      />
      <View style={styles.dates} pointerEvents={editable ? 'auto' : 'none'}>
        <DateField
          label="Du"
          value={start}
          onChange={(d) => {
            const day = startOfDay(d);
            setStart(day);
            if (day > end) setEnd(day);
          }}
        />
        <DateField
          label="Au"
          value={end}
          onChange={(d) => setEnd(startOfDay(d))}
          minimumDate={start}
        />
      </View>
      {editable && (
        <Pressable
          accessibilityRole="button"
          disabled={!dirty || !valid || saving}
          onPress={save}
          style={({ pressed }) => [
            styles.saveButton,
            (!dirty || !valid) && !saved && styles.saveButtonIdle,
            pressed && styles.pressed,
          ]}>
          {saving ? (
            <ActivityIndicator size="small" color={Palette.onPhoto} />
          ) : (
            <Text style={styles.saveLabel}>{saved ? 'Enregistré ✓' : 'Enregistrer'}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

/** Suppression de l'album : lien discret en bas, confirmé, puis retour à la liste. */
function DeleteAlbumLink({ album }: { album: Album }) {
  const deleteAlbum = useDeleteAlbum();
  const [deleting, setDeleting] = useState(false);
  const confirm = () => {
    const n = album.photoCount;
    Alert.alert(
      `Supprimer « ${album.name} » ?`,
      `L'album et ses ${n} photo${n > 1 ? 's' : ''} seront effacés pour tous les membres. Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: "Supprimer l'album",
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAlbum.mutateAsync(album.id);
              router.dismissAll();
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };
  return (
    <Pressable
      accessibilityRole="button"
      disabled={deleting}
      onPress={confirm}
      hitSlop={8}
      style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
      {deleting ? (
        <ActivityIndicator size="small" color={Palette.textMuted} />
      ) : (
        <Text style={styles.deleteText}>Supprimer l&apos;album</Text>
      )}
    </Pressable>
  );
}

/** Photo de couverture : la dernière photo par défaut, ou une image choisie par le propriétaire. */
function CoverSection({ album }: SectionProps) {
  const retryExpired = useExpiredUrlRetry('albums');
  const update = useUpdateAlbum(album.id);
  const editable = canEditAlbum(album.myRole);
  const [busy, setBusy] = useState(false);

  const apply = async (coverUri: string | null) => {
    setBusy(true);
    try {
      await update.mutateAsync({ coverUri });
    } finally {
      setBusy(false);
    }
  };

  const change = async () => {
    const uri = await pickSingleImage();
    if (uri) await apply(uri);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Photo de couverture</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Changer la photo de couverture"
        disabled={!editable || busy}
        onPress={change}
        style={({ pressed }) => [styles.cover, pressed && styles.coverPressed]}>
        {album.coverUri ? (
          <Image
            source={{ uri: album.coverUri, cacheKey: album.coverCacheKey ?? undefined }}
            onError={retryExpired}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={styles.coverEmpty}>
            <Text style={styles.coverEmptyText}>Aucune photo pour le moment</Text>
          </View>
        )}
        {editable && (
          <View style={styles.coverBadge}>
            {busy ? (
              <ActivityIndicator size="small" color={Palette.onPhoto} />
            ) : (
              <SymbolView
                name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                size={16}
                weight="bold"
                tintColor={Palette.onPhoto}
                fallback={<Text style={styles.coverBadgeFallback}>📷</Text>}
              />
            )}
          </View>
        )}
      </Pressable>
      {editable ? (
        <View style={styles.coverActions}>
          <Text style={styles.hint}>
            {album.hasCustomCover
              ? 'Couverture choisie à la main.'
              : "Par défaut, la dernière photo ajoutée à l'album."}
          </Text>
          {album.hasCustomCover && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => apply(null)}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.link}>Revenir à la dernière photo</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Text style={styles.hint}>Seul le propriétaire peut changer la couverture.</Text>
      )}
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
    gap: Spacing.five,
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
  errorText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: Spacing.one,
  },
  sectionCount: {
    color: Palette.textMuted,
    fontWeight: '600',
  },
  dates: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  saveButton: {
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
  saveButtonIdle: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveLabel: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '800',
  },
  cover: {
    aspectRatio: 16 / 10,
    borderRadius: Radii.card,
    overflow: 'hidden',
    backgroundColor: Palette.cardBackground,
  },
  coverPressed: {
    opacity: 0.9,
  },
  coverEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmptyText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  coverBadge: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.pink,
    borderWidth: 3,
    borderColor: Palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadgeFallback: {
    fontSize: 14,
  },
  coverActions: {
    gap: Spacing.one,
  },
  link: {
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: Spacing.one,
  },
  hint: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    paddingHorizontal: Spacing.one,
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  deleteText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
