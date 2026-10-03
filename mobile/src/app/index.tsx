import { SymbolView } from 'expo-symbols';
import { pushOnce } from '@/navigation/push-once';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ADD_BUTTON_SIZE, AddButton } from '@/components/add-button';
import { AlbumCard } from '@/components/album-card';
import { MenuSheet, type MenuItemKey } from '@/components/menu-sheet';
import { HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAlbums } from '@/hooks/use-albums';
import { useAuth } from '@/providers/auth-provider';
import { takePendingInvite } from '@/services/pending-invite';
import type { Album } from '@/types/album';

/** « 4 albums · 2 créés par toi », « 1 album », « 2 albums créés par toi ». */
/**
 * Premier lancement sans album : on explique le principe en trois gestes et on pousse vers la
 * création. Le + flottant reste là, mais l'état vide doit se suffire à lui-même.
 */
function EmptyAlbums({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyHero}>
        {EMPTY_HERO.map((card, index) => (
          <View
            key={card.emoji}
            style={[
              styles.emptyHeroCard,
              {
                transform: [{ translateX: card.offset }, { rotate: card.rotate }],
                zIndex: index === 1 ? 2 : 1,
              },
            ]}>
            <Text style={styles.emptyHeroEmoji}>{card.emoji}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.emptyTitle}>Ton premier album t&apos;attend</Text>
      <Text style={styles.emptyBody}>
        Crée un album pour un week-end, une soirée ou des vacances, invite tes amis, et chacun
        glisse ses photos dedans. Tout le monde repart avec tout.
      </Text>
      <View style={styles.emptySteps}>
        {EMPTY_STEPS.map((step, index) => (
          <View key={step} style={styles.emptyStep}>
            <View style={styles.emptyStepNumber}>
              <Text style={styles.emptyStepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.emptyStepText}>{step}</Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Créer mon premier album"
        onPress={onCreate}
        style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
        <Text style={styles.emptyButtonLabel}>Créer mon premier album</Text>
      </Pressable>
    </View>
  );
}

/** Trois cartes en éventail, écho au paquet de l'écran de tri. */
const EMPTY_HERO = [
  { emoji: '🏖️', rotate: '-10deg', offset: -40 },
  { emoji: '📸', rotate: '0deg', offset: 0 },
  { emoji: '🎉', rotate: '10deg', offset: 40 },
];

const EMPTY_STEPS = [
  'Crée un album avec une période',
  'Invite tes amis par lien ou QR code',
  "Swipe tes photos, elles rejoignent l'album",
];

function ItemGap() {
  return <View style={styles.itemGap} />;
}

function describeAlbums(albums: Album[]): string {
  const total = albums.length;
  const mine = albums.filter((album) => album.myRole === 'owner').length;
  const albumsLabel = `${total} album${total > 1 ? 's' : ''}`;
  if (total === 0 || mine === 0) return albumsLabel;
  if (mine === total) return `${albumsLabel} créé${total > 1 ? 's' : ''} par toi`;
  return `${albumsLabel} · ${mine} créé${mine > 1 ? 's' : ''} par toi`;
}

export default function AlbumsScreen() {
  const { albums, status, refreshing, refresh } = useAlbums();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  // Menu en calque, sans navigation ; clé unique par ouverture (voir MenuSheet).
  const [menuKey, setMenuKey] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Invitation ouverte avant la connexion : on y retourne dès l'arrivée sur l'accueil.
  useEffect(() => {
    const token = takePendingInvite();
    if (token) pushOnce({ pathname: '/join/[token]', params: { token } });
  }, []);

  const openAlbum = (album: Album) =>
    pushOnce({ pathname: '/album/[id]', params: { id: album.id } });

  const onMenuSelect = (key: MenuItemKey) => {
    // On ferme la feuille tout de suite, puis on navigue.
    setMenuKey(null);
    if (key === 'profile') pushOnce('/profile');
    if (key === 'settings') pushOnce('/settings');
    // POC : les mentions légales n'ont pas encore d'écran.
  };

  const menuButton = (
    <Pressable
      accessibilityLabel="Ouvrir le menu"
      accessibilityRole="button"
      onPress={() => setMenuKey((k) => (k ?? 0) + 1)}
      hitSlop={8}
      style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'person.fill', android: 'person', web: 'person' }}
        size={20}
        weight="bold"
        tintColor={Palette.text}
        fallback={<Text style={styles.menuFallback}>☺</Text>}
      />
    </Pressable>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Mes albums</Text>
        <Text style={styles.subtitle}>
          {status === 'ready' && albums.length > 0 ? describeAlbums(albums) : ' '}
        </Text>
      </View>
    </View>
  );

  const empty =
    status === 'loading' ? (
      <ActivityIndicator style={styles.errorText} color={Palette.pink} />
    ) : status === 'error' ? (
      <Text style={styles.errorText}>Impossible de charger tes albums.</Text>
    ) : (
      <EmptyAlbums onCreate={() => pushOnce('/album/new')} />
    );

  return (
    <View style={styles.container}>
      <ScreenHeader right={menuButton} scrolled={scrolled} />
      <FlatList
        data={albums}
        keyExtractor={(album) => album.id}
        renderItem={({ item }) => <AlbumCard album={item} onPress={openAlbum} />}
        ItemSeparatorComponent={ItemGap}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentInsetAdjustmentBehavior="never"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Spacing.two,
            paddingBottom: insets.bottom + ADD_BUTTON_SIZE + Spacing.five,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Palette.pink}
            progressViewOffset={0}
          />
        }
      />

      {/* Masqué sur l'état vide : « Créer mon premier album » porte déjà l'action. */}
      {!(status === 'ready' && albums.length === 0) && (
        <AddButton
          accessibilityLabel="Créer un album"
          onPress={() => pushOnce('/album/new')}
          bottom={insets.bottom + Spacing.four}
        />
      )}

      {menuKey !== null && (
        <MenuSheet
          key={menuKey}
          onSelect={onMenuSelect}
          onLogout={() => {
            // La feuille se ferme, puis la session est effacée : les routes protégées
            // basculent d'elles-mêmes sur l'écran de connexion.
            setMenuKey(null);
            signOut();
          }}
          onClose={() => setMenuKey(null)}
        />
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
  },
  itemGap: {
    height: Spacing.three,
  },
  // 20 pt sous le sous-titre, comme avant les sections (padding 4 + gap de liste 16).
  header: {
    paddingBottom: Spacing.three + Spacing.one,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuFallback: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '900',
  },
  errorText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.two,
  },
  emptyHero: {
    height: 132,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyHeroCard: {
    position: 'absolute',
    width: 88,
    height: 112,
    borderRadius: 20,
    backgroundColor: Palette.card,
    borderWidth: 4,
    borderColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  emptyHeroEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  emptySteps: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.tile,
    backgroundColor: Palette.card,
  },
  emptyStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
  },
  emptyStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStepNumberText: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyStepText: {
    flex: 1,
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyButton: {
    alignSelf: 'stretch',
    height: 56,
    marginTop: Spacing.two,
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
  emptyButtonLabel: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
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
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
