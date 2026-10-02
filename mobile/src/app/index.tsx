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
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAlbums } from '@/hooks/use-albums';
import type { Album } from '@/types/album';

export default function AlbumsScreen() {
  const { albums, status, refreshing, refresh } = useAlbums();
  const insets = useSafeAreaInsets();
  // Menu en calque, sans navigation ; clé unique par ouverture (voir MenuSheet).
  const [menuKey, setMenuKey] = useState<number | null>(null);

  const openAlbum = (album: Album) =>
    router.push({ pathname: '/album/[id]', params: { id: album.id } });

  const onMenuSelect = (key: MenuItemKey) => {
    // On ferme la feuille tout de suite, puis on navigue.
    setMenuKey(null);
    if (key === 'profile') router.push('/profile');
    // POC : paramètres et mentions légales n'ont pas encore d'écran.
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <Text style={styles.brand}>Synkup</Text>
        <Pressable
          accessibilityLabel="Ouvrir le menu"
          accessibilityRole="button"
          onPress={() => setMenuKey((k) => (k ?? 0) + 1)}
          hitSlop={8}
          style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }}
            size={18}
            weight="heavy"
            tintColor={Palette.text}
            fallback={<Text style={styles.menuFallback}>≡</Text>}
          />
        </Pressable>
      </View>
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
      <FlatList
        data={albums}
        keyExtractor={(album) => album.id}
        renderItem={({ item }) => <AlbumCard album={item} onPress={openAlbum} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        // Le contenu défile sous la barre de statut, laissée transparente : iOS ajuste les
        // marges aux zones sûres, Android reçoit un padding équivalent.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === 'ios' ? 0 : insets.top,
            paddingBottom: insets.bottom + Spacing.five,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Palette.pink}
            progressViewOffset={Platform.OS === 'ios' ? 0 : insets.top}
          />
        }
      />

      {menuKey !== null && (
        <MenuSheet
          key={menuKey}
          onSelect={onMenuSelect}
          onLogout={() => {}}
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
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    gap: Spacing.three,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
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
