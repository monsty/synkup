import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { pushOnce } from '@/navigation/push-once';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { getLanguage } from '@/constants/languages';
import { formatQuota, getPlan } from '@/constants/plans';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useDeleteAccount, useMeQuery } from '@/queries/me';
import { getSettingsSync, settingsApi, type Settings } from '@/services/settings-api';
import { clearLocalAccountData } from '@/services/local-data';
import { clearThumbs, thumbsSize } from '@/services/thumbnail-store';

const APP_VERSION = '0.1.0';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuth();
  // Réglages locaux lus en synchrone : l'écran s'affiche d'un coup. Offre et usage viennent de
  // l'API (en cache après la première visite) et remplissent leur ligne.
  const [settings, setSettings] = useState<Settings>(() => getSettingsSync());
  const me = useMeQuery().data;
  const usage = me?.usage ?? null;
  const deleteAccountMutation = useDeleteAccount();
  const [scrolled, setScrolled] = useState(false);
  const [offlineBytes, setOfflineBytes] = useState(thumbsSize);

  const toggle = async (key: 'ownedAlbums' | 'memberAlbums', value: boolean) => {
    // Optimiste : l'interrupteur bouge tout de suite, le stockage suit.
    setSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    }));
    setSettings(await settingsApi.updateNotifications({ [key]: value }));
  };

  const freeSpace = () => {
    if (offlineBytes === 0) return;
    Alert.alert(
      `Libérer ${formatBytes(offlineBytes)} ?`,
      'Les miniatures gardées pour le mode hors ligne seront effacées. Elles reviendront quand tu rouvriras tes albums.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Libérer',
          style: 'destructive',
          onPress: () => {
            clearThumbs();
            setOfflineBytes(thumbsSize());
          },
        },
      ]
    );
  };

  const deleteAccount = () => {
    Alert.alert(
      'Supprimer ton compte ?',
      "Les albums que tu as créés seront supprimés pour tout le monde, avec toutes leurs photos. Tes photos dans les albums de tes amis et ton profil seront aussi effacés. C'est définitif.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer mon compte',
          style: 'destructive',
          onPress: () =>
            deleteAccountMutation.mutate(undefined, {
              onSuccess: async () => {
                // Le compte n'existe plus : on efface ce que le téléphone gardait, puis la
                // session (déjà invalide côté Clerk, d'où l'échec toléré).
                if (user) clearLocalAccountData(user.id);
                await signOut().catch(() => undefined);
              },
              onError: () =>
                Alert.alert(
                  'Suppression impossible',
                  "Ton compte n'a pas pu être supprimé. Vérifie ta connexion et réessaie."
                ),
            }),
        },
      ]
    );
  };

  const plan = me ? getPlan(me.plan) : null;

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
          <Text style={styles.title}>Paramètres</Text>
          <Text style={styles.subtitle}>Langue, notifications et abonnement</Text>
        </View>

        <>
          {/* Abonnement : l'entrée la plus utile, en premier. */}
          <Section title="Mon abonnement">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voir mon abonnement"
              onPress={() => pushOnce('/subscription')}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <RowIcon name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{plan ? `Offre ${plan.name}` : 'Mon offre'}</Text>
                <Text style={styles.rowDetail}>
                  {usage
                    ? `${formatQuota(usage.photos)} photo${usage.photos > 1 ? 's' : ''} sur ${formatQuota(usage.photoQuota)}`
                    : ' '}
                </Text>
              </View>
              <Chevron />
            </Pressable>
          </Section>

          <Section title="Notifications">
            <View style={[styles.row, styles.rowDivider]}>
              <RowIcon
                name={{
                  ios: 'bell.badge.fill',
                  android: 'notifications_active',
                  web: 'notifications_active',
                }}
              />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Mes albums</Text>
                <Text style={styles.rowDetail}>
                  Quand des photos arrivent dans un album que j&apos;ai créé
                </Text>
              </View>
              <Switch
                value={settings.notifications.ownedAlbums}
                onValueChange={(v) => toggle('ownedAlbums', v)}
                trackColor={{ true: Palette.pink, false: Palette.surfaceStrong }}
                thumbColor={Palette.card}
              />
            </View>
            <View style={styles.row}>
              <RowIcon
                name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Albums où je suis membre</Text>
                <Text style={styles.rowDetail}>
                  Quand des photos arrivent dans un album d&apos;un ami
                </Text>
              </View>
              <Switch
                value={settings.notifications.memberAlbums}
                onValueChange={(v) => toggle('memberAlbums', v)}
                trackColor={{ true: Palette.pink, false: Palette.surfaceStrong }}
                thumbColor={Palette.card}
              />
            </View>
          </Section>

          <Section title="Stockage">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Libérer l'espace des photos hors ligne"
              disabled={offlineBytes === 0}
              onPress={freeSpace}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <RowIcon name={{ ios: 'internaldrive', android: 'storage', web: 'storage' }} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Photos hors ligne</Text>
                <Text style={styles.rowDetail}>
                  Miniatures gardées pour voir tes albums sans réseau
                </Text>
              </View>
              <Text style={styles.rowValue}>{formatBytes(offlineBytes)}</Text>
            </Pressable>
          </Section>

          <Section title="Langue">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Changer la langue"
              onPress={() => pushOnce('/language')}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <RowIcon name={{ ios: 'globe', android: 'language', web: 'language' }} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Langue de l&apos;application</Text>
              </View>
              <Text style={styles.rowValue}>{getLanguage(settings.language).nativeName}</Text>
              <Chevron />
            </Pressable>
          </Section>

          <Section title="À propos">
            <View style={styles.row}>
              <RowIcon name={{ ios: 'info.circle', android: 'info', web: 'info' }} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Version</Text>
              </View>
              <Text style={styles.rowValue}>{APP_VERSION}</Text>
            </View>
          </Section>

          {/* Suppression de compte : volontairement en retrait, en texte discret tout en bas. */}
          <Pressable
            accessibilityRole="button"
            disabled={deleteAccountMutation.isPending}
            onPress={deleteAccount}
            hitSlop={8}
            style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
            {deleteAccountMutation.isPending ? (
              <ActivityIndicator size="small" color={Palette.textMuted} />
            ) : (
              <Text style={styles.deleteText}>Supprimer mon compte</Text>
            )}
          </Pressable>
        </>
      </ScrollView>
    </View>
  );
}

/** « 0 Ko », « 840 Ko », « 48 Mo », « 1,2 Go ». */
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1).replace('.', ',')} Go`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function RowIcon({ name }: { name: SymbolViewProps['name'] }) {
  return (
    <View style={styles.rowIcon}>
      <SymbolView
        name={name}
        size={18}
        weight="bold"
        tintColor={Palette.pink}
        fallback={<Text style={styles.rowIconFallback}>•</Text>}
      />
    </View>
  );
}

function Chevron() {
  return (
    <SymbolView
      name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
      size={14}
      weight="heavy"
      tintColor={Palette.textMuted}
      fallback={<Text style={styles.chevronFallback}>›</Text>}
    />
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
  sectionTitle: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.one,
  },
  card: {
    borderRadius: Radii.tile,
    backgroundColor: Palette.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    minHeight: 60,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.surfaceStrong,
  },
  rowPressed: {
    backgroundColor: Palette.background,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconFallback: {
    color: Palette.pink,
    fontSize: 16,
    fontWeight: '900',
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
    lineHeight: 17,
    fontWeight: '600',
  },
  rowValue: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chevronFallback: {
    color: Palette.textMuted,
    fontSize: 18,
    fontWeight: '900',
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
  },
  deleteText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.7,
  },
});
