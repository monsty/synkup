import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Palette, Radii, Spacing } from '@/constants/theme';
import type { AlbumPhoto } from '@/types/album';

const COLUMNS = 3;
const GAP = Spacing.two;
const SIDE_PADDING = Spacing.three;

type Props = {
  photos: AlbumPhoto[];
  refreshing: boolean;
  onRefresh: () => void;
  /** Espace au-dessus du contenu (l'en-tête collant est en dehors de la liste). */
  topInset: number;
  bottomInset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onPressPhoto: (photo: AlbumPhoto) => void;
  /** Mode sélection : les tuiles affichent une case à cocher et le tap bascule la sélection. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (photo: AlbumPhoto) => void;
  /** Tap long sur une tuile hors sélection (entrée en mode gestion). */
  onLongPressPhoto?: (photo: AlbumPhoto) => void;
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
};

export function PhotoGrid({
  photos,
  refreshing,
  onRefresh,
  topInset,
  bottomInset,
  onScroll,
  onPressPhoto,
  selectable = false,
  selectedIds,
  onToggle,
  onLongPressPhoto,
  ListHeaderComponent,
  ListEmptyComponent,
}: Props) {
  const { width } = useWindowDimensions();
  const tileSize = (width - SIDE_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <FlatList
      data={photos}
      keyExtractor={(photo) => photo.id}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentInsetAdjustmentBehavior="never"
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.content, { paddingTop: topInset, paddingBottom: bottomInset }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Palette.pink}
          progressViewOffset={topInset}
        />
      }
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      extraData={selectedIds}
      renderItem={({ item }) => {
        const selected = selectable && !!selectedIds?.has(item.id);
        return (
          <Pressable
            accessibilityLabel={selectable ? 'Sélectionner la photo' : 'Afficher la photo en grand'}
            accessibilityState={selectable ? { selected } : undefined}
            onPress={() => (selectable ? onToggle?.(item) : onPressPhoto(item))}
            // Toujours définie : si elle disparaissait pendant le geste (passage en sélection),
            // le relâché ne serait plus vu comme un appui long et onPress décocherait la tuile.
            onLongPress={() => {
              if (!selectable) onLongPressPhoto?.(item);
            }}
            delayLongPress={350}
            style={({ pressed }) => [
              styles.tile,
              { width: tileSize, height: tileSize },
              pressed && styles.tilePressed,
            ]}>
            <Image
              source={{ uri: item.uri }}
              recyclingKey={item.id}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              style={StyleSheet.absoluteFill}
            />
            {selectable && (
              <>
                {!selected && <View style={styles.dim} />}
                <View style={[styles.check, selected ? styles.checkOn : styles.checkOff]}>
                  {selected && (
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      size={14}
                      weight="heavy"
                      tintColor={Palette.onPhoto}
                      fallback={<Text style={styles.checkFallback}>✓</Text>}
                    />
                  )}
                </View>
              </>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SIDE_PADDING,
    gap: GAP,
    // Laisse l'état vide occuper tout l'espace restant sous l'en-tête pour s'y centrer.
    flexGrow: 1,
  },
  row: {
    gap: GAP,
  },
  tile: {
    borderRadius: Radii.tile,
    overflow: 'hidden',
    backgroundColor: Palette.cardBackground,
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  check: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Palette.onPhoto,
  },
  checkOn: {
    backgroundColor: Palette.pink,
    borderColor: Palette.pink,
  },
  checkOff: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  checkFallback: {
    color: Palette.onPhoto,
    fontSize: 12,
    fontWeight: '900',
  },
});
