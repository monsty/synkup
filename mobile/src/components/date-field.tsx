import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** « sam. 3 oct. » → « Sam. 3 oct. » : seule la première lettre en capitale. */
function format(date: Date): string {
  const text = dateFormat.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Props = {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  minimumDate?: Date;
};

/**
 * Champ de date : même carte blanche que `TextField`. Sur iOS le sélecteur compact natif
 * est posé dans la carte (un tap ouvre le calendrier en popover) ; sur Android la carte
 * ouvre le dialogue système.
 */
export function DateField({ label, value, onChange, minimumDate }: Props) {
  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      onChange: (_event, date) => {
        if (date) onChange(date);
      },
    });

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <View style={styles.frame}>
          {/* Sélecteur compact natif, quasi invisible mais touchable, étiré sur toute la carte. */}
          <DateTimePicker
            // Remonté à chaque changement de valeur : le popover se referme après le choix.
            key={value.getTime()}
            value={value}
            mode="date"
            display="compact"
            locale="fr-FR"
            accentColor={Palette.pink}
            minimumDate={minimumDate}
            onChange={(_event, date) => {
              if (date) onChange(date);
            }}
            style={styles.picker}
          />
          {/* Calque opaque par-dessus : masque l'étiquette native, laisse passer les touches. */}
          <View pointerEvents="none" style={styles.cover}>
            <SymbolView
              name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
              size={18}
              weight="bold"
              tintColor={Palette.pink}
              fallback={<Text style={styles.iconFallback}>▦</Text>}
            />
            <Text style={styles.value}>{format(value)}</Text>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} : ${format(value)}`}
          onPress={openAndroid}
          style={({ pressed }) => [styles.frame, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
            size={18}
            weight="bold"
            tintColor={Palette.pink}
            fallback={<Text style={styles.iconFallback}>▦</Text>}
          />
          <Text style={styles.value}>{format(value)}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: Spacing.one + Spacing.half,
  },
  label: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.one,
  },
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 56,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.tile,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: Palette.card,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
  },
  value: {
    flex: 1,
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '700',
  },
  /**
   * Le sélecteur compact iOS est étiré pour couvrir toute la carte : sa zone tactile native
   * est celle de sa petite étiquette, on l'agrandit donc par transformation. Opacité quasi
   * nulle mais pas zéro : iOS ne délivre plus les touches sous 1 % d'opacité. Le calque
   * opaque au-dessus cache ce qui transparaît, et `overflow: hidden` borne les touches.
   */
  picker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.011,
    transform: [{ scaleX: 4 }, { scaleY: 2.5 }],
  },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    backgroundColor: Palette.card,
  },
  iconFallback: {
    color: Palette.pink,
    fontSize: 16,
  },
});
