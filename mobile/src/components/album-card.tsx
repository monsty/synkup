import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/avatar-stack';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useExpiredUrlRetry } from '@/hooks/use-expired-url-retry';
import {
  describeAlbumStatus,
  formatAlbumRange,
  getAlbumStatus,
  type Album,
  type AlbumStatus,
} from '@/types/album';

/** Ratio de la couverture : large, pour laisser la place au texte dessous. */
const COVER_ASPECT = 16 / 10;

const STATUS_LABEL: Record<AlbumStatus, string> = {
  active: 'En cours',
  upcoming: 'À venir',
  ended: 'Terminé',
};

type Props = {
  album: Album;
  onPress: (album: Album) => void;
};

/**
 * Carte d'album, une par ligne : couverture avec l'état et le nombre de photos en pilules,
 * puis le nom, la période, et les membres en avatars chevauchés.
 */
export function AlbumCard({ album, onPress }: Props) {
  const retryExpired = useExpiredUrlRetry('albums');
  const status = getAlbumStatus(album);
  const people = album.members.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir l'album ${album.name}`}
      onPress={() => onPress(album)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cover}>
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
            <SymbolView
              name={{
                ios: 'photo.on.rectangle.angled',
                android: 'photo_library',
                web: 'photo_library',
              }}
              size={34}
              weight="bold"
              tintColor={Palette.textMuted}
              fallback={<Text style={styles.coverEmptyFallback}>▣</Text>}
            />
            <Text style={styles.coverEmptyText}>Aucune photo pour le moment</Text>
          </View>
        )}

        <View style={styles.coverTop}>
          <View style={[styles.statusPill, status === 'active' && styles.statusPillActive]}>
            {status === 'active' && <View style={styles.liveDot} />}
            <Text style={[styles.statusText, status === 'active' && styles.statusTextActive]}>
              {STATUS_LABEL[status]}
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>
              {album.photoCount} photo{album.photoCount > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {album.name}
        </Text>
        <Text style={styles.period}>
          {formatAlbumRange(album)} · {describeAlbumStatus(album)}
        </Text>
        <View style={styles.footer}>
          <AvatarStack members={album.members} />
          <Text style={styles.people}>
            {people} personne{people > 1 ? 's' : ''}
          </Text>
          <View style={styles.chevron}>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={14}
              weight="heavy"
              tintColor={Palette.pink}
              fallback={<Text style={styles.chevronFallback}>›</Text>}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  cover: {
    aspectRatio: COVER_ASPECT,
    backgroundColor: Palette.cardBackground,
  },
  coverEmpty: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  coverEmptyFallback: {
    color: Palette.textMuted,
    fontSize: 30,
  },
  coverEmptyText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  coverTop: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    height: 30,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(20, 20, 26, 0.6)',
  },
  statusPillActive: {
    backgroundColor: Palette.pink,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.mint,
  },
  statusText: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '800',
  },
  statusTextActive: {
    color: Palette.onPhoto,
  },
  countPill: {
    height: 30,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(20, 20, 26, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  body: {
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  people: {
    flex: 1,
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronFallback: {
    color: Palette.pink,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
});
