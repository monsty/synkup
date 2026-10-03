import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View } from 'react-native';
import { Pressable as SheetPressable } from 'react-native-gesture-handler';
import QRCode from 'react-native-qrcode-svg';

import { BottomSheet } from '@/components/bottom-sheet';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAlbumInvite, useResetInvite } from '@/queries/albums';
import { canEditAlbum, type Album } from '@/types/album';

const QR_SIZE = 184;
const COPIED_MS = 1800;

type Props = {
  album: Album;
  /** Appelé une fois le fondu de sortie terminé : le parent peut alors démonter la feuille. */
  onClose: () => void;
};

/**
 * Inviter dans l'album : QR code à scanner, lien à copier, ou partage système. Le lien vient
 * de l'API (un seul lien actif par album) ; le propriétaire peut le remplacer.
 */
export function ShareSheet({ album, onClose }: Props) {
  const invite = useAlbumInvite(album.id);
  const resetInvite = useResetInvite(album.id);
  const url = invite.data?.url ?? null;
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const copy = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const share = () => {
    if (!url) return;
    Share.share({ message: `Rejoins l'album « ${album.name} » sur Synkup : ${url}`, url });
  };

  const confirmReset = () =>
    Alert.alert(
      'Générer un nouveau lien ?',
      "L'ancien lien et son QR code ne fonctionneront plus. Les membres déjà dans l'album le restent.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Nouveau lien',
          style: 'destructive',
          onPress: () =>
            resetInvite.mutate(undefined, {
              onError: () => Alert.alert('Oups', 'Impossible de générer un nouveau lien.'),
            }),
        },
      ]
    );

  return (
    <BottomSheet dismissLabel="Fermer le partage" onClose={onClose}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Inviter dans l&apos;album</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {album.name}
        </Text>
      </View>

      <View style={styles.qrWrap}>
        <View style={styles.qrCard}>
          {url && !resetInvite.isPending ? (
            <QRCode value={url} size={QR_SIZE} color={Palette.text} backgroundColor={Palette.card} />
          ) : (
            <View style={styles.qrPlaceholder}>
              {invite.isError ? (
                <Text style={styles.qrHint}>Lien indisponible, réessaie.</Text>
              ) : (
                <ActivityIndicator color={Palette.pink} />
              )}
            </View>
          )}
        </View>
        <Text style={styles.qrHint}>Fais scanner ce code avec l&apos;appareil photo</Text>
      </View>

      <View style={styles.linkRow}>
        <SymbolView
          name={{ ios: 'link', android: 'link', web: 'link' }}
          size={16}
          weight="bold"
          tintColor={Palette.textMuted}
          fallback={<Text style={styles.linkIconFallback}>⛓</Text>}
        />
        <Text style={styles.link} numberOfLines={1} ellipsizeMode="middle">
          {url ? url.replace(/^https?:\/\//, '') : ' '}
        </Text>
      </View>

      <View style={styles.actions}>
        <SheetPressable
          accessibilityRole="button"
          accessibilityLabel="Copier le lien"
          disabled={!url}
          onPress={copy}
          style={({ pressed }) => [
            styles.button,
            styles.buttonSecondary,
            pressed && styles.pressed,
          ]}>
          <SymbolView
            name={
              copied
                ? { ios: 'checkmark', android: 'check', web: 'check' }
                : { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' }
            }
            size={18}
            weight="bold"
            tintColor={Palette.pink}
            fallback={<Text style={styles.buttonIconFallback}>{copied ? '✓' : '⧉'}</Text>}
          />
          <Text style={[styles.buttonLabel, styles.buttonLabelSecondary]}>
            {copied ? 'Lien copié' : 'Copier le lien'}
          </Text>
        </SheetPressable>
        <SheetPressable
          accessibilityRole="button"
          accessibilityLabel="Partager le lien"
          disabled={!url}
          onPress={share}
          style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
            size={18}
            weight="bold"
            tintColor={Palette.onPhoto}
            fallback={<Text style={styles.buttonIconFallbackOnPink}>↑</Text>}
          />
          <Text style={styles.buttonLabel}>Partager</Text>
        </SheetPressable>
      </View>

      {/* Remplacer le lien : réservé au propriétaire, discret, confirmé par une alerte. */}
      {canEditAlbum(album.myRole) && (
        <SheetPressable
          accessibilityRole="button"
          disabled={resetInvite.isPending}
          onPress={confirmReset}
          hitSlop={8}
          style={({ pressed }) => [styles.resetLink, pressed && styles.pressed]}>
          <Text style={styles.resetText}>Générer un nouveau lien</Text>
        </SheetPressable>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  qrWrap: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  qrCard: {
    padding: Spacing.three,
    borderRadius: Radii.tile,
    backgroundColor: Palette.card,
    borderWidth: 2,
    borderColor: Palette.surfaceStrong,
  },
  qrPlaceholder: {
    width: QR_SIZE,
    height: QR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
  resetText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  qrHint: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: Palette.background,
  },
  link: {
    flex: 1,
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '700',
  },
  linkIconFallback: {
    color: Palette.textMuted,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 56,
    borderRadius: Radii.pill,
  },
  buttonSecondary: {
    backgroundColor: Palette.surface,
  },
  buttonPrimary: {
    backgroundColor: Palette.pink,
  },
  buttonLabel: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '800',
  },
  buttonLabelSecondary: {
    color: Palette.pink,
  },
  buttonIconFallback: {
    color: Palette.pink,
    fontSize: 16,
    fontWeight: '900',
  },
  buttonIconFallbackOnPink: {
    color: Palette.onPhoto,
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
