import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams } from 'expo-router';
import { pushOnce } from '@/navigation/push-once';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressModal } from '@/components/progress-modal';
import { ShareSheet } from '@/components/share-sheet';
import { ADD_BUTTON_SIZE, AddButton } from '@/components/add-button';
import { AvatarStack } from '@/components/avatar-stack';
import { PageLoader } from '@/components/page-loader';
import { PhotoGrid } from '@/components/photo-grid';
import { PhotoViewer } from '@/components/photo-viewer';
import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAlbum } from '@/hooks/use-album';
import { useDeletePhotos } from '@/queries/albums';
import { useDownloadSelection } from '@/hooks/use-download-selection';
import { formatAlbumRange } from '@/types/album';

const FAB_SIZE = ADD_BUTTON_SIZE;

export default function AlbumScreen() {
  const { id: albumId } = useLocalSearchParams<{ id: string }>();
  const { album, photos, status, refreshing, refresh } = useAlbum(albumId);
  const deletePhotos = useDeletePhotos(albumId);
  const insets = useSafeAreaInsets();
  const download = useDownloadSelection(album, photos);
  // Visualiseur en calque, sans navigation : index de la photo ouverte ou null.
  // La clé change à chaque ouverture pour repartir d'une instance neuve, même si on rouvre
  // pendant le fondu de sortie de la précédente.
  const [viewer, setViewer] = useState<{ index: number; key: number } | null>(null);
  // Filet sous l'en-tête collant dès que la grille a défilé.
  const [scrolled, setScrolled] = useState(false);
  // Feuille de partage en calque ; clé unique par ouverture (voir BottomSheet).
  const [shareKey, setShareKey] = useState<number | null>(null);
  const openViewer = (index: number) => setViewer((v) => ({ index, key: (v?.key ?? 0) + 1 }));
  const selecting = download.mode === 'selecting';
  const busy = download.mode === 'running';

  // Mode gestion (tap long) : sélection de photos à supprimer de l'album.
  const [manageIds, setManageIds] = useState<Set<string> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const managing = manageIds !== null;
  const manageCount = manageIds?.size ?? 0;

  // Tout / rien : agit sur la sélection active (téléchargement ou gestion).
  const selectedCountAll = managing ? manageCount : download.selectedIds.size;
  const allSelected = photos.length > 0 && selectedCountAll === photos.length;
  const selectAllCurrent = () =>
    managing ? setManageIds(new Set(photos.map((p) => p.id))) : download.selectAll();
  const clearAllCurrent = () => (managing ? setManageIds(new Set()) : download.clearAll());

  const startManaging = (photoId: string) => {
    if (selecting || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setManageIds(new Set([photoId]));
  };
  const toggleManaged = (photoId: string) =>
    setManageIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  const stopManaging = () => setManageIds(null);

  const confirmDelete = () => {
    if (!album || manageCount === 0 || deleting) return;
    const plural = manageCount > 1 ? 's' : '';
    Alert.alert(
      `Supprimer ${manageCount} photo${plural} ?`,
      `Elle${plural} disparaîtr${manageCount > 1 ? 'ont' : 'a'} de l'album pour tout le monde.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deletePhotos.mutateAsync([...(manageIds ?? [])]);
              setManageIds(null);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };
  const selectedCount = download.selectedIds.size;

  // En sélection (téléchargement ou gestion), le bouton de téléchargement devient la croix
  // qui ferme la sélection : même geste que le bouton de sortie en bas à gauche.
  const closing = selecting || managing;
  const downloadButton = (
    <Pressable
      accessibilityLabel={
        closing ? 'Quitter la sélection' : 'Enregistrer des photos sur le téléphone'
      }
      accessibilityRole="button"
      disabled={status !== 'ready' || busy || deleting}
      onPress={managing ? stopManaging : selecting ? download.cancel : download.start}
      hitSlop={8}
      style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}>
      {busy ? (
        <ActivityIndicator size="small" color={Palette.pink} />
      ) : (
        <SymbolView
          name={
            closing
              ? { ios: 'xmark', android: 'close', web: 'close' }
              : { ios: 'arrow.down.to.line', android: 'download', web: 'download' }
          }
          size={18}
          weight="heavy"
          tintColor={Palette.pink}
          fallback={<Text style={styles.downloadFallback}>{closing ? '✕' : '↓'}</Text>}
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
          {/* Pour le propriétaire, le titre mène aux réglages de l'album (comme le nom d'un groupe). */}
          {album.myRole === 'owner' ? (
            <Pressable
              accessibilityLabel="Gérer l'album"
              accessibilityRole="button"
              disabled={closing || busy}
              onPress={() => pushOnce({ pathname: '/album/manage', params: { albumId } })}
              hitSlop={8}
              style={({ pressed }) => [styles.titleButton, pressed && styles.titleButtonPressed]}>
              <Text style={styles.albumName} numberOfLines={1}>
                {album.name}
              </Text>
              {/* Crayon seul, en muted : signale l'édition sans concurrencer le titre. */}
              <SymbolView
                name={{ ios: 'square.and.pencil', android: 'edit_square', web: 'edit_square' }}
                size={18}
                weight="bold"
                tintColor={Palette.textMuted}
                fallback={<Text style={styles.titleChevronFallback}>✎</Text>}
              />
            </Pressable>
          ) : (
            <View style={styles.titleButton}>
              <Text style={styles.albumName} numberOfLines={1}>
                {album.name}
              </Text>
            </View>
          )}
          <Text style={styles.period}>{formatAlbumRange(album)}</Text>
          {/* Qui est dans l'album, et le bouton pour inviter (QR code ou lien). */}
          <View style={styles.membersRow}>
            <Pressable
              accessibilityLabel={`Voir les ${album.members.length} membres`}
              accessibilityRole="button"
              disabled={closing || busy}
              onPress={() => pushOnce({ pathname: '/album/members', params: { albumId } })}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <AvatarStack members={album.members} />
            </Pressable>
            <Pressable
              accessibilityLabel="Inviter dans l'album"
              accessibilityRole="button"
              disabled={closing || busy}
              onPress={() => setShareKey((k) => (k ?? 0) + 1)}
              style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }}
                size={16}
                weight="bold"
                tintColor={Palette.onPhoto}
                fallback={<Text style={styles.inviteFallback}>+</Text>}
              />
              <Text style={styles.inviteLabel}>Inviter</Text>
            </Pressable>
          </View>
        </View>
      )}
      {/* En sélection : bandeau qui explique ce qui a été pré-coché, avec tout / rien. */}
      {(selecting || managing) && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.bannerWrap}>
          <View style={styles.selectAllRow}>
            <Text style={styles.selectAllCount}>
              {selectedCountAll} / {photos.length} sélectionnée{selectedCountAll > 1 ? 's' : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={allSelected ? clearAllCurrent : selectAllCurrent}
              hitSlop={8}
              style={({ pressed }) => [styles.selectAllButton, pressed && styles.pressed]}>
              <Text style={styles.selectAllLabel}>
                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
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
        albumId={albumId}
        photos={photos}
        refreshing={refreshing}
        onRefresh={refresh}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        topInset={Spacing.one}
        bottomInset={insets.bottom + FAB_SIZE + Spacing.five}
        onPressPhoto={(photo) => openViewer(photos.findIndex((p) => p.id === photo.id))}
        selectable={selecting || managing}
        selectedIds={managing ? manageIds : download.selectedIds}
        onToggle={(photo) => (managing ? toggleManaged(photo.id) : download.toggle(photo.id))}
        onLongPressPhoto={(photo) => startManaging(photo.id)}
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

      {managing && (
        <View
          style={[
            styles.bottomAction,
            styles.bottomActionSpread,
            { bottom: insets.bottom + Spacing.four },
          ]}>
          <Pressable
            accessibilityLabel="Quitter la sélection"
            accessibilityRole="button"
            onPress={stopManaging}
            style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}>
            <SymbolView
              name={{ ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' }}
              size={26}
              weight="heavy"
              tintColor={Palette.pink}
              fallback={<Text style={styles.backFallback}>↩</Text>}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={
              manageCount > 0
                ? `Supprimer ${manageCount} photo${manageCount > 1 ? 's' : ''}`
                : 'Aucune photo sélectionnée'
            }
            accessibilityRole="button"
            disabled={deleting}
            onPress={confirmDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
            {deleting ? (
              <ActivityIndicator size="small" color={Palette.onPhoto} />
            ) : (
              <SymbolView
                name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                size={26}
                weight="bold"
                tintColor={Palette.onPhoto}
                fallback={<Text style={styles.deleteFallback}>🗑</Text>}
              />
            )}
            <View style={[styles.badge, styles.badgeDelete]}>
              <Text style={[styles.badgeText, styles.badgeDeleteText]}>{manageCount}</Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* Masqué tant que la zone du bas est occupée par une sélection. */}
      {!downloadPill && !managing && (
        <AddButton
          accessibilityLabel="Trier mes photos de la période"
          onPress={() => pushOnce({ pathname: '/swipe', params: { albumId } })}
          bottom={insets.bottom + Spacing.four}
        />
      )}
      {status === 'loading' && <PageLoader />}

      <ProgressModal overlay={download.overlay} />
      {album && shareKey !== null && (
        <ShareSheet key={shareKey} album={album} onClose={() => setShareKey(null)} />
      )}
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
  /** Suppression : rond sombre avec corbeille blanche, pastille rose. */
  deleteButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Palette.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  deleteFallback: {
    fontSize: 24,
  },
  badgeDelete: {
    backgroundColor: Palette.pink,
  },
  badgeDeleteText: {
    color: Palette.onPhoto,
  },
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
  titleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    maxWidth: '100%',
    paddingHorizontal: Spacing.two,
  },
  titleButtonPressed: {
    opacity: 0.6,
  },
  titleChevronFallback: {
    color: Palette.textMuted,
    fontSize: 16,
    fontWeight: '900',
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    marginTop: Spacing.two,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    height: 36,
    paddingLeft: Spacing.two + Spacing.one,
    paddingRight: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: Palette.pink,
  },
  inviteLabel: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '800',
  },
  inviteFallback: {
    color: Palette.onPhoto,
    fontSize: 16,
    fontWeight: '900',
  },
  bannerWrap: {
    marginTop: Spacing.one,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  selectAllCount: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  selectAllButton: {
    height: 32,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectAllLabel: {
    color: Palette.pink,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '800',
  },
  /** Bandeau d'information : carte blanche arrondie, icône rose, texte muted. */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    // Sous le bandeau : padding bas de l'en-tête (16) + espacement de la grille (8) = 24.
    marginTop: Spacing.two,
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
    flexShrink: 1,
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
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});
