import React from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useStore } from '../src/store';
import { t } from '../src/i18n';
import { colors, spacing, radius } from '../src/theme';
import AuroraBackground from '../src/components/AuroraBackground';

type RootStackParamList = { Home: undefined; Settings: undefined };
type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const sensitivity = useStore((s) => s.sensitivity);
  const setSensitivity = useStore((s) => s.setSensitivity);
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
  const sound = useStore((s) => s.sound);
  const setSound = useStore((s) => s.setSound);
  const haptics = useStore((s) => s.haptics);
  const setHaptics = useStore((s) => s.setHaptics);

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('settings_title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>

          {/* Sensitivity */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardLabel}>{t('settings_sensitivity')}</Text>
              <Text style={styles.accentValue}>{sensitivity}</Text>
            </View>

            <View style={styles.sensitivityRow}>
              <TouchableOpacity
                style={[styles.stepBtn, sensitivity <= 10 && styles.stepBtnOff]}
                onPress={() => sensitivity > 10 && setSensitivity(sensitivity - 1)}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>

              <View style={styles.trackBg}>
                <View style={[styles.trackFill, { width: `${((sensitivity - 10) / 70) * 100}%` }]} />
              </View>

              <TouchableOpacity
                style={[styles.stepBtn, sensitivity >= 80 && styles.stepBtnOff]}
                onPress={() => sensitivity < 80 && setSensitivity(sensitivity + 1)}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.hint}>{t('settings_low')}</Text>
              <Text style={styles.hint}>{t('settings_high')}</Text>
            </View>
          </View>

          {/* Units */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('settings_units')}</Text>
            <View style={styles.toggleRow}>
              {(['metric', 'imperial'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, units === u && styles.unitBtnActive]}
                  onPress={() => setUnits(u)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitBtnText, units === u && styles.unitBtnTextActive]}>
                    {u === 'metric' ? 'km/h' : 'mph'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sound */}
          <View style={[styles.card, styles.switchCard]}>
            <Text style={styles.cardLabel}>{t('settings_sound')}</Text>
            <Switch
              value={sound}
              onValueChange={setSound}
              trackColor={{ false: colors.surface, true: colors.accentDim }}
              thumbColor={sound ? colors.accent : colors.textMuted}
            />
          </View>

          {/* Haptics */}
          <View style={[styles.card, styles.switchCard]}>
            <Text style={styles.cardLabel}>{t('settings_haptics')}</Text>
            <Switch
              value={haptics}
              onValueChange={setHaptics}
              trackColor={{ false: colors.surface, true: colors.accentDim }}
              thumbColor={haptics ? colors.accent : colors.textMuted}
            />
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: colors.accent, fontWeight: '300', lineHeight: 32 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },

  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accentValue: { fontSize: 20, fontWeight: '800', color: colors.accent },

  sensitivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: spacing.sm,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: { opacity: 0.25 },
  stepBtnText: { fontSize: 20, color: colors.text, fontWeight: '500', lineHeight: 24 },

  trackBg: {
    flex: 1,
    height: 5,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },

  hint: { fontSize: 11, color: colors.textDim },

  toggleRow: { flexDirection: 'row', gap: 8 },
  unitBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
  },
  unitBtnActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderAccent,
  },
  unitBtnText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  unitBtnTextActive: { color: colors.accent },
});
