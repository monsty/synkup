import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { PageLoader } from '@/components/page-loader';
import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import { ShareSheet } from '@/components/share-sheet';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useAlbumQuery, useRemoveMember, useUpdateMemberRole } from '@/queries/albums';
import { getCurrentUserId } from '@/services/auth-api';
import {
  assignableRoles,
  canEditAlbum,
  canRemoveMember,
  ROLE_LABEL,
  type AlbumMember,
} from '@/types/album';

export default function MembersScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const insets = useSafeAreaInsets();
  const { data: album, isPending, isError } = useAlbumQuery(albumId);
  const status = album ? 'ready' : isPending && !isError ? 'loading' : 'error';
  const updateRole = useUpdateMemberRole(albumId);
  const removeMember = useRemoveMember(albumId);
  const [scrolled, setScrolled] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shareKey, setShareKey] = useState<number | null>(null);

  const run = async (memberId: string, action: () => Promise<unknown>) => {
    setBusyId(memberId);
    try {
      await action();
    } catch (e: unknown) {
      Alert.alert('Oups', e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setBusyId(null);
    }
  };

  /** Actions possibles sur un membre selon mon rôle : transférer la propriété, retirer. */
  const openActions = (member: AlbumMember) => {
    if (!album) return;
    const roles = assignableRoles(album.myRole, member.role);
    const removable = canRemoveMember(album.myRole, member.role);
    if (member.id === getCurrentUserId() || (roles.length === 0 && !removable)) return;

    const actions: { label: string; destructive?: boolean; onPress: () => void }[] = roles.map(
      (role) => ({
        label:
          role === 'owner' ? 'Transférer la propriété' : `Passer ${ROLE_LABEL[role].toLowerCase()}`,
        onPress: () => {
          if (role === 'owner') {
            Alert.alert(
              `Transférer la propriété à ${member.name} ?`,
              'Tu deviendras simple membre de cet album.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Transférer',
                  onPress: () =>
                    run(member.id, () => updateRole.mutateAsync({ memberId: member.id, role })),
                },
              ]
            );
            return;
          }
          run(member.id, () => updateRole.mutateAsync({ memberId: member.id, role }));
        },
      })
    );
    if (removable) {
      actions.push({
        label: "Retirer de l'album",
        destructive: true,
        onPress: () =>
          Alert.alert(`Retirer ${member.name} ?`, "Cette personne n'aura plus accès à l'album.", [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Retirer',
              style: 'destructive',
              onPress: () => run(member.id, () => removeMember.mutateAsync(member.id)),
            },
          ]),
      });
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: member.name,
          options: [...actions.map((a) => a.label), 'Annuler'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: actions.findIndex((a) => a.destructive),
        },
        (index) => actions[index]?.onPress()
      );
    } else {
      Alert.alert(member.name, undefined, [
        ...actions.map((a) => ({
          text: a.label,
          style: a.destructive ? ('destructive' as const) : ('default' as const),
          onPress: a.onPress,
        })),
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  const count = album?.members.length ?? 0;
  const isOwner = album ? canEditAlbum(album.myRole) : false;

  return (
    <View style={styles.container}>
      <ScreenHeader
        left={<BackButton accessibilityLabel="Retour à l'album" />}
        scrolled={scrolled}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.two, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Membres</Text>
          <Text style={styles.subtitle}>
            {album ? `${count} personne${count > 1 ? 's' : ''} dans « ${album.name} »` : ' '}
          </Text>
        </View>

        {status === 'error' && (
          <Text style={styles.errorText}>Impossible de charger l&apos;album.</Text>
        )}

        {album && (
          <>
            <View style={styles.list}>
              {album.members.map((member, index) => {
                const actionable =
                  member.id !== getCurrentUserId() &&
                  (assignableRoles(album.myRole, member.role).length > 0 ||
                    canRemoveMember(album.myRole, member.role));
                const busy = busyId === member.id;
                return (
                  <Pressable
                    key={member.id}
                    accessibilityRole={actionable ? 'button' : undefined}
                    accessibilityLabel={`${member.name}, ${ROLE_LABEL[member.role]}`}
                    disabled={!actionable || busy}
                    onPress={() => openActions(member)}
                    style={({ pressed }) => [
                      styles.row,
                      index < count - 1 && styles.rowDivider,
                      pressed && styles.rowPressed,
                    ]}>
                    <Avatar uri={member.avatarUri} name={member.name} size={40} />
                    <View style={styles.rowText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {member.name}
                        {member.id === getCurrentUserId() && <Text style={styles.you}> (toi)</Text>}
                      </Text>
                      <Text style={styles.photoCount}>
                        {member.photoCount === 0
                          ? 'Aucune photo envoyée'
                          : `${member.photoCount} photo${member.photoCount > 1 ? 's' : ''} envoyée${member.photoCount > 1 ? 's' : ''}`}
                      </Text>
                    </View>
                    {/* Seul le propriétaire porte une étiquette : tous les autres sont membres. */}
                    {member.role === 'owner' && (
                      <View style={styles.rolePill}>
                        <Text style={styles.roleText}>{ROLE_LABEL.owner}</Text>
                      </View>
                    )}
                    {/* Sans action, pas d'espace réservé : la pilule s'aligne sur le bord droit. */}
                    {busy ? (
                      <ActivityIndicator size="small" color={Palette.pink} />
                    ) : actionable ? (
                      <SymbolView
                        name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
                        size={16}
                        weight="heavy"
                        tintColor={Palette.textMuted}
                        fallback={<Text style={styles.moreFallback}>…</Text>}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>
              {isOwner
                ? 'Touche un membre pour lui transférer la propriété ou le retirer.'
                : 'Seul le propriétaire gère les membres.'}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Inviter dans l'album"
              onPress={() => setShareKey((k) => (k ?? 0) + 1)}
              style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }}
                size={18}
                weight="bold"
                tintColor={Palette.onPhoto}
                fallback={<Text style={styles.inviteFallback}>+</Text>}
              />
              <Text style={styles.inviteLabel}>Inviter quelqu&apos;un</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      {status === 'loading' && <PageLoader />}
      {album && shareKey !== null && (
        <ShareSheet key={shareKey} album={album} onClose={() => setShareKey(null)} />
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
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.half,
    marginBottom: Spacing.two,
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
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  list: {
    borderRadius: Radii.tile,
    backgroundColor: Palette.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.surfaceStrong,
  },
  rowPressed: {
    backgroundColor: Palette.background,
  },
  rowText: {
    flex: 1,
  },
  name: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '700',
  },
  you: {
    color: Palette.textMuted,
    fontWeight: '600',
  },
  photoCount: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  rolePill: {
    height: 28,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.pill,
    backgroundColor: Palette.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 12,
    fontWeight: '800',
  },
  moreFallback: {
    color: Palette.textMuted,
    fontSize: 16,
    fontWeight: '900',
  },
  hint: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 56,
    marginTop: Spacing.two,
    borderRadius: Radii.pill,
    backgroundColor: Palette.pink,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  inviteLabel: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 17,
    fontWeight: '800',
  },
  inviteFallback: {
    color: Palette.onPhoto,
    fontSize: 18,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
