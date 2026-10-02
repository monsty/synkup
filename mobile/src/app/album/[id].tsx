import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DownloadModal } from '@/components/download-modal';
import { PhotoGrid } from '@/components/photo-grid';
import { PhotoViewer } from '@/components/photo-viewer';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAlbum } from '@/hooks/use-album';
import { useDownloadSelection } from '@/hooks/use-download-selection';
import { formatAlbumRange } from '@/types/album';

const FAB_SIZE = 68;
/** Liquid Glass (iOS 26+) ; ailleurs on garde le rond rose plein. */
const HAS_LIQUID_GLASS = isLiquidGlassAvailable();
/** Soulèvement à la pression : léger agrandissement et éclaircissement, sans déformation. */
const FAB_PRESSED_SCALE = 1.08;
const FAB_PRESSED_GLOW = 0.22;
const FAB_SPRING = { damping: 14, stiffness: 260 };

export default function AlbumScreen() {
  const { id: albumId } = useLocalSearchParams<{ id: string }>();
  const { album, photos, status, refreshing, refresh } = useAlbum(albumId);
  const insets = useSafeAreaInsets();
  const download = useDownloadSelection(album, photos);
  // Visualiseur en calque, sans navigation : index de la photo ouverte ou null.
  // La clé change à chaque ouverture pour repartir d'une instance neuve, même si on rouvre
  // pendant le fondu de sortie de la précédente.
  const [viewer, setViewer] = useState<{ index: number; key: number } | null>(null);
  const openViewer = (index: number) => setViewer((v) => ({ index, key: (v?.key ?? 0) + 1 }));
  const selecting = download.mode === 'selecting';
  const busy = download.mode === 'running';
  const selectedCount = download.selectedIds.size;

  // Le mode interactif natif du verre étire le bouton sous le doigt : on anime nous-mêmes.
  const fabPressed = useSharedValue(0);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(fabPressed.get(), [0, 1], [1, FAB_PRESSED_SCALE]) }],
  }));
  const fabGlowStyle = useAnimatedStyle(() => ({
    opacity: fabPressed.get() * FAB_PRESSED_GLOW,
  }));

  const downloadButton = (
    <Pressable
      accessibilityLabel={
        selecting ? 'Annuler la sélection' : 'Enregistrer des photos sur le téléphone'
      }
      accessibilityRole="button"
      disabled={status !== 'ready' || busy}
      onPress={selecting ? download.cancel : download.start}
      hitSlop={8}
      style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}>
      {busy ? (
        <ActivityIndicator size="small" color={Palette.pink} />
      ) : (
        <SymbolView
          name={
            selecting
              ? { ios: 'xmark', android: 'close', web: 'close' }
              : { ios: 'arrow.down.to.line', android: 'download', web: 'download' }
          }
          size={18}
          weight="heavy"
          tintColor={Palette.pink}
          fallback={<Text style={styles.downloadFallback}>{selecting ? '✕' : '↓'}</Text>}
        />
      )}
    </Pressable>
  );

  // Bouton flottant en bas, à la place du + : progression, résultat, ou action de la sélection.
  let downloadPill: React.ReactNode = null;
  if (selecting) {
    downloadPill = (
      <Pressable
        accessibilityLabel={
          selectedCount > 0
            ? `Enregistrer ${selectedCount} photo${selectedCount > 1 ? 's' : ''} sélectionnée${selectedCount > 1 ? 's' : ''}`
            : 'Aucune photo sélectionnée'
        }
        accessibilityRole="button"
        onPress={download.confirm}
        style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}>
        <SymbolView
          name={{ ios: 'arrow.down.to.line', android: 'download', web: 'download' }}
          size={28}
          weight="heavy"
          tintColor={Palette.onPhoto}
          fallback={<Text style={styles.confirmFallback}>↓</Text>}
        />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{selectedCount}</Text>
        </View>
      </Pressable>
    );
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <Pressable
          accessibilityLabel="Retour aux albums"
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={18}
            weight="heavy"
            tintColor={Palette.text}
            fallback={<Text style={styles.headerIconFallback}>‹</Text>}
          />
        </Pressable>
        <Text style={styles.brand}>Synkup</Text>
        <View style={styles.pillRow}>
          <View style={styles.countPill}>
            <Text style={styles.countValue}>{status === 'ready' ? photos.length : '–'}</Text>
            <Text style={styles.countUnit}>photo{photos.length > 1 ? 's' : ''}</Text>
          </View>
          {downloadButton}
        </View>
      </View>
      {album && (
        <View style={styles.albumTitle}>
          <Text style={styles.albumName}>{album.name}</Text>
          <Text style={styles.period}>{formatAlbumRange(album)}</Text>
        </View>
      )}
    </View>
  );

  const empty =
    status === 'loading' ? (
      <ActivityIndicator style={styles.empty} color={Palette.pink} />
    ) : status === 'error' ? (
      <Text style={[styles.emptyText, styles.empty]}>Impossible de charger l&apos;album.</Text>
    ) : status === 'not-found' ? (
      <Text style={[styles.emptyText, styles.empty]}>Cet album n&apos;existe plus.</Text>
    ) : (
      <Text style={[styles.emptyText, styles.empty]}>
        Aucune photo pour le moment. Ajoute les tiennes avec le bouton +.
      </Text>
    );

  return (
    <View style={styles.container}>
      <PhotoGrid
        photos={photos}
        refreshing={refreshing}
        onRefresh={refresh}
        // Le contenu défile sous la barre de statut, laissée transparente.
        topInset={insets.top}
        bottomInset={insets.bottom + FAB_SIZE + Spacing.five}
        onPressPhoto={(photo) => openViewer(photos.findIndex((p) => p.id === photo.id))}
        selectable={selecting}
        selectedIds={download.selectedIds}
        onToggle={(photo) => download.toggle(photo.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
      />

      {downloadPill && (
        <View
          style={[
            styles.bottomAction,
            selecting && styles.bottomActionSpread,
            { bottom: insets.bottom + Spacing.four },
          ]}>
          {selecting && (
            <Pressable
              accessibilityLabel="Quitter la sélection"
              accessibilityRole="button"
              onPress={download.cancel}
              style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' }}
                size={26}
                weight="heavy"
                tintColor={Palette.pink}
                fallback={<Text style={styles.backFallback}>↩</Text>}
              />
            </Pressable>
          )}
          {downloadPill}
        </View>
      )}

      {/* Pas de <Link asChild> ici : son Slot écrase un style passé en fonction. */}
      {/* Masqué tant que la zone du bas est occupée par l'action de téléchargement. */}
      {!downloadPill && (
        <Pressable
          accessibilityLabel="Trier mes photos de la période"
          onPress={() => router.push({ pathname: '/swipe', params: { albumId } })}
          onPressIn={() => fabPressed.set(withSpring(1, FAB_SPRING))}
          onPressOut={() => fabPressed.set(withSpring(0, FAB_SPRING))}
          style={[styles.fabWrap, { bottom: insets.bottom + Spacing.four }]}>
          <Animated.View style={fabStyle}>
            {HAS_LIQUID_GLASS ? (
              // Pas d'`isInteractive` : il étire et déforme le verre sous le doigt.
              <GlassView
                glassEffectStyle="regular"
                tintColor={Palette.pinkGlass}
                style={styles.fabGlass}>
                <PlusIcon />
                <Animated.View style={[styles.fabGlow, fabGlowStyle]} />
              </GlassView>
            ) : (
              <View style={[styles.fabGlass, styles.fabSolid]}>
                <PlusIcon />
                <Animated.View style={[styles.fabGlow, fabGlowStyle]} />
              </View>
            )}
          </Animated.View>
        </Pressable>
      )}
      <DownloadModal overlay={download.overlay} />
      {viewer && (
        <PhotoViewer
          key={viewer.key}
          photos={photos}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </View>
  );
}

function PlusIcon() {
  return (
    <SymbolView
      name={{ ios: 'plus', android: 'add', web: 'add' }}
      size={30}
      weight="heavy"
      tintColor={Palette.onPhoto}
      fallback={<Text style={styles.fabFallback}>+</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  brand: {
    flex: 1,
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surfaceOpaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadFallback: {
    color: Palette.pink,
    fontSize: 18,
    fontWeight: '900',
  },
  /** Zone des boutons en bas : même hauteur que le + pour tous. */
  /** En sélection, le ✕ est collé à gauche et le téléchargement à droite ; une pilule seule reste centrée. */
  bottomAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bottomActionSpread: {
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconFallback: {
    color: Palette.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  exitButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Palette.surfaceOpaque,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  backFallback: {
    color: Palette.pink,
    fontSize: 26,
    fontWeight: '900',
  },
  confirmButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Palette.pink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  confirmFallback: {
    color: Palette.onPhoto,
    fontSize: 28,
    fontWeight: '900',
  },
  /** Pastille du nombre de photos cochées, à cheval sur le bord haut-droit du bouton. */
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 26,
    height: 26,
    paddingHorizontal: Spacing.one + Spacing.half,
    borderRadius: 13,
    backgroundColor: Palette.mint,
    borderWidth: 2,
    borderColor: Palette.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Palette.onMint,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
  },
  countValue: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countUnit: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  albumTitle: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  albumName: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  period: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
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
  fabWrap: {
    position: 'absolute',
    alignSelf: 'center',
    // Pas d'ombre ni d'opacité ici : sur le parent d'une GlassView, ça casse l'effet de verre.
  },
  fabGlass: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSolid: {
    backgroundColor: Palette.pink,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  /** Voile blanc enfant du verre (une opacité sur un enfant ne casse pas l'effet). */
  fabGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    pointerEvents: 'none',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  fabFallback: {
    color: Palette.onPhoto,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
});
