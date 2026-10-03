import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Pressable as SheetPressable } from 'react-native-gesture-handler';
import QRCode from 'react-native-qrcode-svg';

import { BottomSheet } from '@/components/bottom-sheet';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import type { Album } from '@/types/album';

const QR_SIZE = 184;
const COPIED_MS = 1800;

/** Lien d'invitation : une URL web, pour que quelqu'un sans l'app puisse l'ouvrir. */
export function getAlbumInviteUrl(album: Album): string {
  return `https://synkup.app/join/${album.id}`;
}

type Props = {
  album: Album;
  /** Appelé une fois le fondu de sortie terminé : le parent peut alors démonter la feuille. */
  onClose: () => void;
};

/** Inviter dans l'album : QR code à scanner, lien à copier, ou partage système. */
export function ShareSheet({ album, onClose }: Props) {
  const url = getAlbumInviteUrl(album);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const copy = async () => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const share = () =>
    Share.share({
      message: `Rejoins l'album « ${album.name} » sur Synkup : ${url}`,
      url,
    });

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
          <QRCode value={url} size={QR_SIZE} color={Palette.text} backgroundColor={Palette.card} />
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
          {url.replace(/^https?:\/\//, '')}
        </Text>
      </View>

      <View style={styles.actions}>
        <SheetPressable
          accessibilityRole="button"
          accessibilityLabel="Copier le lien"
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
