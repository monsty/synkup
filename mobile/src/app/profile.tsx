import type { MeDto } from '@synkup/shared';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { PageLoader } from '@/components/page-loader';
import { useMyStats } from '@/queries/albums';
import { useMeQuery, useUpdateMe } from '@/queries/me';
import type { MeUpdate } from '@/services/me-api';
import { pickSingleImage } from '@/services/photo-picker';

const AVATAR_SIZE = 112;
const NICKNAME_MAX = 24;
const TOAST_MS = 2200;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const meQuery = useMeQuery();
  const updateMe = useUpdateMe();
  const stats = useMyStats().data ?? null;
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  return (
    <View style={styles.container}>
      {/* Pas de KeyboardAvoidingView : la liste ajuste elle-même ses insets au clavier. */}
      <View style={styles.container}>
        <ScreenHeader left={<BackButton />} scrolled={scrolled} />
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          // iOS : la liste réserve la hauteur du clavier et fait défiler le champ focalisé
          // au-dessus, en gardant le clavier ouvert quand on scrolle.
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Spacing.two,
              // Marge sous le dernier élément : le champ focalisé ne colle pas au clavier.
              paddingBottom: insets.bottom + Spacing.six + Spacing.four,
            },
          ]}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Mon profil</Text>
            <Text style={styles.subtitle}>C&apos;est toi que tes amis verront dans les albums</Text>
          </View>

          {!meQuery.data && meQuery.isError && (
            <Text style={styles.errorText}>Impossible de charger ton profil.</Text>
          )}

          {meQuery.data && (
            <ProfileForm
              me={meQuery.data}
              stats={stats}
              saving={updateMe.isPending}
              onSave={(update) => updateMe.mutateAsync(update).catch(() => null)}
              onToast={showToast}
            />
          )}
        </ScrollView>
        {meQuery.isPending && <PageLoader />}
      </View>

      {toast && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + Spacing.two }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

type ProfileFormProps = {
  me: MeDto;
  stats: { albums: number; photosShared: number } | null;
  saving: boolean;
  /** Renvoie le profil enregistré, ou `null` en cas d'échec. */
  onSave: (update: MeUpdate) => Promise<MeDto | null>;
  onToast: (text: string) => void;
};

/** Formulaire monté une fois le profil connu : son brouillon part des valeurs enregistrées. */
function ProfileForm({ me, stats, saving, onSave, onToast }: ProfileFormProps) {
  const [nickname, setNickname] = useState(me.nickname);
  // Photo nouvellement choisie sur le téléphone ; sinon on affiche celle du profil.
  const [pickedAvatar, setPickedAvatar] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const trimmedNickname = nickname.trim();
  const nicknameError =
    touched && trimmedNickname.length === 0
      ? 'Choisis un surnom.'
      : trimmedNickname.length > NICKNAME_MAX
        ? `${NICKNAME_MAX} caractères maximum.`
        : null;
  const dirty = trimmedNickname !== me.nickname || pickedAvatar !== null;
  const avatarSource = pickedAvatar
    ? { uri: pickedAvatar }
    : me.avatarUrl
      ? { uri: me.avatarUrl, cacheKey: me.avatarCacheKey ?? undefined }
      : null;

  const changeAvatar = async () => {
    const uri = await pickSingleImage();
    if (uri) setPickedAvatar(uri);
  };

  const submit = async () => {
    setTouched(true);
    if (!dirty) {
      onToast('Rien à enregistrer');
      return;
    }
    if (nicknameError) return;
    const saved = await onSave({
      ...(trimmedNickname !== me.nickname && { nickname: trimmedNickname }),
      ...(pickedAvatar && { avatarUri: pickedAvatar }),
    });
    onToast(saved ? 'Profil enregistré' : 'Enregistrement impossible');
    if (saved) {
      setTouched(false);
      setPickedAvatar(null);
    }
  };

  return (
    <>
      {/* Photo de profil, avec un bouton rose pour la changer. */}
      <View style={styles.avatarBlock}>
        <Pressable
          accessibilityLabel="Changer ma photo de profil"
          accessibilityRole="button"
          onPress={changeAvatar}
          style={({ pressed }) => [styles.avatarWrap, pressed && styles.avatarPressed]}>
          {avatarSource ? (
            <Image
              source={avatarSource}
              contentFit="cover"
              transition={150}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text style={styles.avatarInitial}>{(trimmedNickname[0] ?? '?').toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <SymbolView
              name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
              size={16}
              weight="bold"
              tintColor={Palette.onPhoto}
              fallback={<Text style={styles.avatarBadgeFallback}>📷</Text>}
            />
          </View>
        </Pressable>
        <Text style={styles.avatarHint}>Touche la photo pour la changer</Text>
      </View>

      {/* Trois chiffres légers pour donner vie à la page. */}
      <View style={styles.stats}>
        <Stat value={stats ? String(stats.albums) : '–'} label="albums" />
        <View style={styles.statDivider} />
        <Stat value={stats ? String(stats.photosShared) : '–'} label="photos partagées" />
      </View>

      <View style={styles.form}>
        <TextField
          label="Surnom"
          value={nickname}
          onChangeText={(v) => {
            setNickname(v);
            setTouched(true);
          }}
          placeholder="Ton surnom"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={NICKNAME_MAX + 4}
          returnKeyType="done"
          onSubmitEditing={submit}
          error={nicknameError}
          hint={`${trimmedNickname.length} / ${NICKNAME_MAX}`}
        />
        {/* Liée à la connexion (Clerk) : affichée, pas modifiable ici. */}
        <TextField
          label="Adresse email"
          value={me.email}
          onChangeText={() => undefined}
          editable={false}
          hint="C'est l'adresse de ta connexion, elle ne se modifie pas ici."
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enregistrer le profil"
        disabled={saving}
        onPress={submit}
        style={({ pressed }) => [
          styles.saveButton,
          !dirty && styles.saveButtonIdle,
          pressed && styles.pressed,
        ]}>
        {saving ? (
          <ActivityIndicator size="small" color={Palette.onPhoto} />
        ) : (
          <Text style={styles.saveLabel}>Enregistrer</Text>
        )}
      </Pressable>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
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
  avatarBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Palette.cardBackground,
    borderWidth: 4,
    borderColor: Palette.card,
  },
  avatarEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 44,
    fontWeight: '900',
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.pink,
    borderWidth: 3,
    borderColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeFallback: {
    fontSize: 14,
  },
  avatarHint: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.tile,
    backgroundColor: Palette.card,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  statValue: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: Palette.surfaceStrong,
  },
  form: {
    gap: Spacing.three + Spacing.one,
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
    shadowOpacity: 0,
    elevation: 0,
  },
  saveLabel: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '800',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    height: 44,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.pill,
    backgroundColor: Palette.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '700',
  },
});
