import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressModal } from '@/components/progress-modal';
import { PhotoGrid } from '@/components/photo-grid';
import { PhotoViewer } from '@/components/photo-viewer';
import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
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
  // Filet sous l'en-tête collant dès que la grille a défilé.
  const [scrolled, setScrolled] = useState(false);
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

  const headerRight = (
    <View style={styles.pillRow}>
      {/* L'étiquette n'apparaît qu'une fois le nombre connu, avec un fondu. */}
      {status === 'ready' && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.countPill}>
          <Text style={styles.countValue}>{photos.length}</Text>
          <Text style={styles.countUnit}>photo{photos.length > 1 ? 's' : ''}</Text>
        </Animated.View>
      )}
      {downloadButton}
    </View>
  );

  const header = (
    <View style={styles.header}>
      {album && (
        <View style={styles.albumTitle}>
          <Text style={styles.albumName}>{album.name}</Text>
          <Text style={styles.period}>{formatAlbumRange(album)}</Text>
        </View>
      )}
      {/* En sélection : bandeau qui explique ce qui a été pré-coché. */}
      {selecting && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.banner}>
          <View style={styles.bannerIcon}>
            <SymbolView
              name={
                download.preselectedCount > 0
                  ? { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }
                  : { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
              }
              size={18}
              weight="bold"
              tintColor={Palette.pink}
              fallback={<Text style={styles.bannerIconFallback}>✦</Text>}
            />
          </View>
          <Text style={styles.bannerText}>
            {download.preselectedCount > 0
              ? "On t'a pré-sélectionné les photos qui n'ont pas encore été enregistrées sur ce téléphone."
              : 'Tu as déjà toutes les photos sur ce téléphone. Coche celles que tu veux enregistrer à nouveau.'}
          </Text>
        </Animated.View>
      )}
    </View>
  );

  const empty =
    status === 'loading' ? undefined : status === 'error' ? (
      <EmptyState emoji="😶‍🌫️" title="Oups" body="Impossible de charger l'album." />
    ) : status === 'not-found' ? (
      <EmptyState emoji="🫥" title="Album introuvable" body="Cet album n'existe plus." />
    ) : (
      <EmptyState
        emoji="📸"
        title="Aucune photo pour le moment"
        body="Sois la première personne à dégainer : ajoute les tiennes avec le bouton +"
      />
    );

  return (
    <View style={styles.container}>
      <ScreenHeader
        left={<BackButton accessibilityLabel="Retour aux albums" />}
        right={headerRight}
        scrolled={scrolled}
      />
      <PhotoGrid
        photos={photos}
        refreshing={refreshing}
        onRefresh={refresh}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        topInset={Spacing.one}
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
      {/* Chargement : loader centré sur tout l'écran, l'en-tête reste visible derrière. */}
      {status === 'loading' && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          {/* iOS ne propose que small (20) et large (36) : on agrandit le small pour un entre-deux. */}
          <ActivityIndicator size="small" color={Palette.pink} style={styles.loadingSpinner} />
        </View>
      )}

      <ProgressModal overlay={download.overlay} />
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

type EmptyStateProps = { emoji: string; title: string; body: string };

/** État vide centré dans l'espace restant sous l'en-tête. */
function EmptyState({ emoji, title, body }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyEmojiWrap}>
        <Text style={styles.emptyEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
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
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
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
  /** Étiquette d'info : pas de fond, pour ne pas ressembler aux boutons ronds gris. */
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    height: 40,
    paddingHorizontal: Spacing.one,
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
  /** Bandeau d'information : carte blanche arrondie, icône rose, texte muted. */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    // Sous le bandeau : padding bas de l'en-tête (16) + espacement de la grille (8) = 24.
    // Au-dessus : gap de l'en-tête (16) + cette marge (4) = 20, car la ligne de la date
    // garde ~4 pt vides sous ses lettres : à l'œil les deux marges sont égales.
    marginTop: Spacing.one,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.tile,
    backgroundColor: Palette.card,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIconFallback: {
    color: Palette.pink,
    fontSize: 16,
    fontWeight: '800',
  },
  bannerText: {
    flex: 1,
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
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
  loadingSpinner: {
    transform: [{ scale: 1.4 }],
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
    // Compense visuellement le bouton + en bas pour un centrage perçu juste.
    paddingBottom: Spacing.five,
  },
  emptyEmojiWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyEmoji: {
    fontSize: 40,
    lineHeight: 48,
  },
  emptyTitle: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
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
