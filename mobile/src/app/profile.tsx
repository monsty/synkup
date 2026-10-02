import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField } from '@/components/text-field';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { albumApi } from '@/services/album-api';
import { pickSquareImage } from '@/services/photo-picker';
import type { Profile, ProfileUpdate } from '@/services/profile-api';

const AVATAR_SIZE = 112;
const NICKNAME_MAX = 24;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOAST_MS = 2200;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, status, saving, save } = useProfile();
  const [stats, setStats] = useState<{ albums: number; photosShared: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    albumApi.getMyStats().then((result) => {
      if (active) setStats(result);
    });
    return () => {
      active = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Platform.OS === 'ios' ? 0 : insets.top,
              paddingBottom: insets.bottom + Spacing.five,
            },
          ]}>
          <View style={styles.brandRow}>
            <Pressable
              accessibilityLabel="Retour"
              accessibilityRole="button"
              onPress={back}
              hitSlop={8}
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={18}
                weight="heavy"
                tintColor={Palette.text}
                fallback={<Text style={styles.roundButtonFallback}>‹</Text>}
              />
            </Pressable>
            <Text style={styles.brand}>Synkup</Text>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>Mon profil</Text>
            <Text style={styles.subtitle}>C&apos;est toi que tes amis verront dans les albums</Text>
          </View>

          {status === 'loading' && <ActivityIndicator style={styles.loader} color={Palette.pink} />}

          {status === 'error' && (
            <Text style={styles.errorText}>Impossible de charger ton profil.</Text>
          )}

          {status === 'ready' && profile && (
            <ProfileForm
              profile={profile}
              stats={stats}
              saving={saving}
              onSave={save}
              onToast={showToast}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

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
  profile: Profile;
  stats: { albums: number; photosShared: number } | null;
  saving: boolean;
  onSave: (update: ProfileUpdate) => Promise<boolean>;
  onToast: (text: string) => void;
};

/** Formulaire monté une fois le profil connu : son brouillon part des valeurs enregistrées. */
function ProfileForm({ profile, stats, saving, onSave, onToast }: ProfileFormProps) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [email, setEmail] = useState(profile.email);
  const [avatarUri, setAvatarUri] = useState<string | null>(profile.avatarUri);
  const [touched, setTouched] = useState(false);

  const trimmedNickname = nickname.trim();
  const trimmedEmail = email.trim();
  const nicknameError =
    touched && trimmedNickname.length === 0
      ? 'Choisis un surnom.'
      : trimmedNickname.length > NICKNAME_MAX
        ? `${NICKNAME_MAX} caractères maximum.`
        : null;
  const emailError =
    touched && trimmedEmail.length > 0 && !EMAIL_PATTERN.test(trimmedEmail)
      ? 'Cette adresse ne semble pas valide.'
      : touched && trimmedEmail.length === 0
        ? 'Indique ton adresse email.'
        : null;
  const dirty =
    trimmedNickname !== profile.nickname ||
    trimmedEmail !== profile.email ||
    avatarUri !== profile.avatarUri;

  const changeAvatar = async () => {
    const uri = await pickSquareImage();
    if (uri) setAvatarUri(uri);
  };

  const submit = async () => {
    setTouched(true);
    if (!dirty) {
      onToast('Rien à enregistrer');
      return;
    }
    if (nicknameError || emailError) return;
    const ok = await onSave({ nickname: trimmedNickname, email: trimmedEmail, avatarUri });
    onToast(ok ? 'Profil enregistré' : 'Enregistrement impossible');
    if (ok) setTouched(false);
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
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
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
          returnKeyType="next"
          error={nicknameError}
          hint={`${trimmedNickname.length} / ${NICKNAME_MAX}`}
        />
        <TextField
          label="Adresse email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setTouched(true);
          }}
          placeholder="toi@exemple.fr"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={emailError}
          hint="Elle sert à te retrouver quand un ami t'invite dans un album."
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonFallback: {
    color: Palette.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  brand: {
    flex: 1,
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.half,
    marginTop: -Spacing.two,
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
  loader: {
    marginTop: Spacing.six,
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
