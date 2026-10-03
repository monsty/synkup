import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Fonts, Palette } from '@/constants/theme';
import type { AlbumMember } from '@/types/album';

const SIZE = 28;
const OVERLAP = 10;
const MAX_VISIBLE = 4;

type Props = {
  members: AlbumMember[];
};

/** Avatars chevauchés des membres, avec un « +N » si tout le monde ne tient pas. */
export function AvatarStack({ members }: Props) {
  const visible = members.slice(0, MAX_VISIBLE);
  const rest = members.length - visible.length;

  return (
    <View style={styles.row}>
      {visible.map((member, index) => (
        <Avatar
          key={member.id}
          uri={member.avatarUri}
          name={member.name}
          size={SIZE}
          style={[styles.avatar, index > 0 && styles.overlap]}
        />
      ))}
      {rest > 0 && (
        <View style={[styles.avatar, styles.more, styles.overlap]}>
          <Text style={styles.moreText}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: Palette.card,
  },
  overlap: {
    marginLeft: -OVERLAP,
  },
  more: {
    backgroundColor: Palette.surfaceOpaque,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 11,
    fontWeight: '800',
  },
});
