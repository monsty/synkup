import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

type Step = 'welcome' | 'email' | 'code';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_LENGTH = 6;

/** Trois photos en éventail, comme le paquet de l'écran de tri : l'app en une image. */
const HERO_PHOTOS = [
  { uri: 'https://picsum.photos/seed/synkup-hero-1/400/520', rotate: '-10deg', offset: -46 },
  { uri: 'https://picsum.photos/seed/synkup-hero-2/400/520', rotate: '0deg', offset: 0 },
  { uri: 'https://picsum.photos/seed/synkup-hero-3/400/520', rotate: '10deg', offset: 46 },
];

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'apple' | 'google' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const trimmedEmail = email.trim();
  const emailValid = EMAIL_PATTERN.test(trimmedEmail);
  const codeValid = code.trim().length === CODE_LENGTH;

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setBusy(null);
    }
  };

  const sendCode = () =>
    run('email', async () => {
      await auth.requestEmailCode(trimmedEmail);
      setCode('');
      setStep('code');
    });

  const verify = () => run('email', () => auth.verifyEmailCode(trimmedEmail, code.trim()));

  const goBack = () => {
    setError(null);
    setStep(step === 'code' ? 'email' : 'welcome');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        centered
        left={step !== 'welcome' ? <BackButton onPress={goBack} /> : undefined}
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
          { paddingTop: Spacing.two, paddingBottom: Math.max(insets.bottom, Spacing.three) },
        ]}>
        {step === 'welcome' && (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(120)}
            style={styles.step}>
            <View style={styles.hero}>
              {HERO_PHOTOS.map((photo, index) => (
                <View
                  key={photo.uri}
                  style={[
                    styles.heroCard,
                    {
                      transform: [{ translateX: photo.offset }, { rotate: photo.rotate }],
                      zIndex: index === 1 ? 2 : 1,
                    },
                  ]}>
                  <Image
                    source={{ uri: photo.uri }}
                    contentFit="cover"
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              ))}
            </View>

            <View style={styles.titleBlock}>
              <Text style={styles.title}>Tes photos, dans l&apos;album de tout le monde</Text>
              <Text style={styles.subtitle}>
                Swipe les photos de ta galerie vers l&apos;album partagé. Tes amis font pareil. Tout
                le monde a tout.
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={!!busy}
                onPress={() => run('apple', () => auth.signInWithProvider('apple'))}
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonApple,
                  pressed && styles.pressed,
                ]}>
                {busy === 'apple' ? (
                  <ActivityIndicator size="small" color={Palette.onPhoto} />
                ) : (
                  <>
                    <SymbolView
                      name={{ ios: 'apple.logo', android: 'phone_iphone', web: 'phone_iphone' }}
                      size={20}
                      weight="bold"
                      tintColor={Palette.onPhoto}
                      fallback={<Text style={styles.buttonIconFallback}></Text>}
                    />
                    <Text style={[styles.buttonLabel, styles.buttonLabelOnDark]}>
                      Continuer avec Apple
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={!!busy}
                onPress={() => run('google', () => auth.signInWithProvider('google'))}
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonGoogle,
                  pressed && styles.pressed,
                ]}>
                {busy === 'google' ? (
                  <ActivityIndicator size="small" color={Palette.text} />
                ) : (
                  <>
                    <Text style={styles.googleMark}>G</Text>
                    <Text style={styles.buttonLabel}>Continuer avec Google</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={!!busy}
                onPress={() => {
                  setError(null);
                  setStep('email');
                }}
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonEmail,
                  pressed && styles.pressed,
                ]}>
                <SymbolView
                  name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
                  size={18}
                  weight="bold"
                  tintColor={Palette.onPhoto}
                  fallback={<Text style={styles.buttonIconFallback}>✉</Text>}
                />
                <Text style={[styles.buttonLabel, styles.buttonLabelOnDark]}>
                  Continuer avec un email
                </Text>
              </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.legal}>
              En continuant, tu acceptes les conditions d&apos;utilisation et la politique de
              confidentialité.
            </Text>
          </Animated.View>
        )}

        {step === 'email' && (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(120)}
            style={styles.step}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Ton adresse email</Text>
              <Text style={styles.subtitle}>
                On t&apos;envoie un code à 6 chiffres, pas de mot de passe à retenir.
              </Text>
            </View>
            <TextField
              label="Adresse email"
              value={email}
              onChangeText={setEmail}
              placeholder="toi@exemple.fr"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              autoFocus
              returnKeyType="send"
              onSubmitEditing={() => emailValid && sendCode()}
              error={error}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!emailValid || !!busy}
              onPress={sendCode}
              style={({ pressed }) => [
                styles.button,
                styles.buttonEmail,
                !emailValid && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}>
              {busy ? (
                <ActivityIndicator size="small" color={Palette.onPhoto} />
              ) : (
                <Text style={[styles.buttonLabel, styles.buttonLabelOnDark]}>
                  Recevoir mon code
                </Text>
              )}
            </Pressable>
          </Animated.View>
        )}

        {step === 'code' && (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(120)}
            style={styles.step}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Vérifie tes emails</Text>
              <Text style={styles.subtitle}>
                Saisis le code reçu sur <Text style={styles.subtitleStrong}>{trimmedEmail}</Text>
              </Text>
            </View>
            <TextField
              label="Code de connexion"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              placeholder="123456"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
              maxLength={CODE_LENGTH}
              returnKeyType="done"
              onSubmitEditing={() => codeValid && verify()}
              error={error}
              hint="Le code est valable 10 minutes."
            />
            <Pressable
              accessibilityRole="button"
              disabled={!codeValid || !!busy}
              onPress={verify}
              style={({ pressed }) => [
                styles.button,
                styles.buttonEmail,
                !codeValid && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}>
              {busy ? (
                <ActivityIndicator size="small" color={Palette.onPhoto} />
              ) : (
                <Text style={[styles.buttonLabel, styles.buttonLabelOnDark]}>Me connecter</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!!busy}
              onPress={sendCode}
              hitSlop={8}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
              <Text style={styles.linkText}>Renvoyer le code</Text>
            </Pressable>
          </Animated.View>
        )}
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
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.four,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  step: {
    flex: 1,
    gap: Spacing.four,
  },
  hero: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  heroCard: {
    position: 'absolute',
    width: 136,
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Palette.cardBackground,
    borderWidth: 4,
    borderColor: Palette.card,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitleStrong: {
    color: Palette.text,
    fontWeight: '800',
  },
  actions: {
    gap: Spacing.two + Spacing.one,
    marginTop: 'auto',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 56,
    borderRadius: Radii.pill,
  },
  buttonApple: {
    backgroundColor: Palette.text,
  },
  buttonGoogle: {
    backgroundColor: Palette.card,
    borderWidth: 2,
    borderColor: Palette.surfaceStrong,
  },
  buttonEmail: {
    backgroundColor: Palette.pink,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonLabel: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '800',
  },
  buttonLabelOnDark: {
    color: Palette.onPhoto,
  },
  buttonIconFallback: {
    color: Palette.onPhoto,
    fontSize: 18,
    fontWeight: '900',
  },
  googleMark: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 20,
    fontWeight: '900',
  },
  error: {
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  legal: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  linkText: {
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '800',
  },
});
