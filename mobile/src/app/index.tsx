import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumCard } from '@/components/album-card';
import { MenuSheet, type MenuItemKey } from '@/components/menu-sheet';
import { HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAlbums } from '@/hooks/use-albums';
import { useAuth } from '@/providers/auth-provider';
import type { Album } from '@/types/album';

export default function AlbumsScreen() {
  const { albums, status, refreshing, refresh } = useAlbums();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  // Menu en calque, sans navigation ; clé unique par ouverture (voir MenuSheet).
  const [menuKey, setMenuKey] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const openAlbum = (album: Album) =>
    router.push({ pathname: '/album/[id]', params: { id: album.id } });

  const onMenuSelect = (key: MenuItemKey) => {
    // On ferme la feuille tout de suite, puis on navigue.
    setMenuKey(null);
    if (key === 'profile') router.push('/profile');
    // POC : paramètres et mentions légales n'ont pas encore d'écran.
  };

  const menuButton = (
    <Pressable
      accessibilityLabel="Ouvrir le menu"
      accessibilityRole="button"
      onPress={() => setMenuKey((k) => (k ?? 0) + 1)}
      hitSlop={8}
      style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
      {/* SF Symbols n'a pas de points verticaux : on tourne la version horizontale. */}
      <SymbolView
        name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }}
        size={20}
        weight="heavy"
        tintColor={Palette.text}
        style={Platform.OS === 'ios' ? styles.menuIconVertical : undefined}
        fallback={<Text style={styles.menuFallback}>⋮</Text>}
      />
    </Pressable>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Mes albums</Text>
        <Text style={styles.subtitle}>
          {status === 'ready'
            ? `${albums.length} album${albums.length > 1 ? 's' : ''} partagé${albums.length > 1 ? 's' : ''} avec toi`
            : ' '}
        </Text>
      </View>
    </View>
  );

  const empty =
    status === 'loading' ? (
      <ActivityIndicator style={styles.empty} color={Palette.pink} />
    ) : status === 'error' ? (
      <Text style={[styles.emptyText, styles.empty]}>Impossible de charger tes albums.</Text>
    ) : (
      <Text style={[styles.emptyText, styles.empty]}>Aucun album pour le moment.</Text>
    );

  return (
    <View style={styles.container}>
      <ScreenHeader right={menuButton} scrolled={scrolled} />
      <FlatList
        data={albums}
        keyExtractor={(album) => album.id}
        renderItem={({ item }) => <AlbumCard album={item} onPress={openAlbum} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentInsetAdjustmentBehavior="never"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.two, paddingBottom: insets.bottom + Spacing.five },
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
    gap: Spacing.three,
  },
  header: {
    paddingBottom: Spacing.one,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconVertical: {
    transform: [{ rotate: '90deg' }],
  },
  menuFallback: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '900',
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
  empty: {
    marginTop: Spacing.six,
  },
  emptyText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
});
