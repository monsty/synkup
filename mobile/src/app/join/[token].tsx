import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { PageLoader } from '@/components/page-loader';
import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAcceptInvite, useInvitePreview } from '@/queries/albums';
import { takePendingInvite } from '@/services/pending-invite';
import { describeAlbumStatus, formatAlbumRange } from '@/types/album';

const AVATAR_SIZE = 32;

/**
 * Ouvert par un lien ou un QR code d'invitation (`https://<domaine>/join/<jeton>`, domaine
 * fixé par l'API, ou `synkup://join/<jeton>`). Montre l'album avant de le rejoindre. Route protégée : sans
 * session, la connexion s'affiche et l'accueil rouvre l'invitation ensuite.
 */
export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();

  // L'invitation est arrivée à destination : l'accueil n'a plus à la rouvrir.
  useEffect(() => {
    takePendingInvite();
  }, []);

  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const openAlbum = (albumId: string) =>
    // Remplace l'invitation : retour arrière = liste des albums.
    router.replace({ pathname: '/album/[id]', params: { id: albumId } });

  const join = () => {
    setError(null);
    accept.mutate(token, {
      onSuccess: (album) => openAlbum(album.id),
      onError: () => setError("Impossible de rejoindre l'album. Réessaie."),
    });
  };

  const data = preview.data;
  const album = data?.album;

  return (
    <View style={styles.container}>
      <ScreenHeader left={<BackButton accessibilityLabel="Fermer" />} scrolled={scrolled} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.two, paddingBottom: insets.bottom + Spacing.four },
        ]}>
        {preview.isError && (
          <Message
            emoji="📡"
            title="Pas de connexion"
            body="Impossible d'ouvrir cette invitation pour l'instant. Vérifie ton réseau et réessaie."
          />
        )}

        {data === null && (
          <>
            <Message
              emoji="🔗"
              title="Ce lien ne fonctionne plus"
              body="Il a peut-être été remplacé. Demande un nouveau lien à la personne qui t'a invité."
            />
            <PrimaryButton label="Retour à mes albums" onPress={() => router.replace('/')} />
          </>
        )}

        {data && album && (
          <>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>
                {data.alreadyMember ? 'Tu fais déjà partie de cet album' : 'On t’invite dans un album'}
              </Text>
              <Text style={styles.subtitle}>
                {album.ownerName} partage ses photos avec toi
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.cover}>
                {album.coverUrl ? (
                  <Image
                    source={{ uri: album.coverUrl, cacheKey: album.coverCacheKey ?? undefined }}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <Text style={styles.coverEmoji}>📸</Text>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name} numberOfLines={2}>
                  {album.name}
                </Text>
                <Text style={styles.period}>
                  {formatAlbumRange(album)} · {describeAlbumStatus(album)}
                </Text>
                <View style={styles.membersRow}>
                  <View style={styles.avatars}>
                    {album.members.map((member, index) => (
                      <Avatar
                        key={member.id}
                        uri={member.avatarUrl}
                        name={member.name}
                        size={AVATAR_SIZE}
                        style={[styles.avatar, index > 0 && styles.avatarOverlap]}
                      />
                    ))}
                  </View>
                  <Text style={styles.memberCount}>
                    {album.memberCount} personne{album.memberCount > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </View>

            {data.alreadyMember ? (
              <PrimaryButton label="Ouvrir l'album" onPress={() => openAlbum(album.id)} />
            ) : (
              <>
                <PrimaryButton
                  label="Rejoindre l'album"
                  busy={accept.isPending}
                  onPress={join}
                />
                <Text style={[styles.hint, error && styles.hintError]}>
                  {error ??
                    'Tu pourras y glisser tes photos prises pendant la période, et voir celles des autres.'}
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>
      {preview.isPending && <PageLoader />}
    </View>
  );
}

function Message({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={styles.message}>
      <Text style={styles.messageEmoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{body}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      {busy ? (
        <ActivityIndicator color={Palette.onPhoto} />
      ) : (
        <Text style={styles.buttonLabel}>{label}</Text>
      )}
    </Pressable>
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
    gap: Spacing.one,
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
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    borderRadius: Radii.card,
    backgroundColor: Palette.card,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cover: {
    aspectRatio: 16 / 10,
    backgroundColor: Palette.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 48,
  },
  cardBody: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three + Spacing.one,
    gap: Spacing.one,
  },
  name: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 22,
    fontWeight: '800',
  },
  period: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatar: {
    borderWidth: 2,
    borderColor: Palette.card,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  memberCount: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
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
  buttonLabel: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '800',
  },
  hint: {
    marginTop: -Spacing.two,
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
  hintError: {
    color: Palette.pink,
  },
  message: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.two,
  },
  messageEmoji: {
    fontSize: 56,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
