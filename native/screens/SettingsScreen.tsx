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

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const colors = {
  bg: '#08080F',
  surface: 'rgba(255,255,255,0.06)',
  surfaceBorder: 'rgba(139,92,246,0.25)',
  surface2: 'rgba(255,255,255,0.10)',
  accent: '#8B5CF6',
  accentPink: '#EC4899',
  accentGlow: 'rgba(139,92,246,0.3)',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.5)',
  textDim: 'rgba(255,255,255,0.3)',
  danger: '#EF4444',
};

// ---------------------------------------------------------------------------
// Types / navigation
// ---------------------------------------------------------------------------
type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------
export default function SettingsScreen({ navigation }: Props) {
  const sensitivity = useStore((s) => s.sensitivity);
  const setSensitivity = useStore((s) => s.setSensitivity);
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
  const sound = useStore((s) => s.sound);
  const setSound = useStore((s) => s.setSound);
  const haptics = useStore((s) => s.haptics);
  const setHaptics = useStore((s) => s.setHaptics);

  const decreaseSensitivity = () => {
    if (sensitivity > 10) setSensitivity(sensitivity - 1);
  };

  const increaseSensitivity = () => {
    if (sensitivity < 80) setSensitivity(sensitivity + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{t('settings_back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings_title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <View style={styles.content}>

        {/* Sensitivity */}
        <View style={styles.card}>
          <View style={styles.rowTop}>
            <Text style={styles.settingLabel}>{t('settings_sensitivity')}</Text>
            <Text style={styles.sensitivityValue}>{sensitivity}</Text>
          </View>

          <View style={styles.sensitivityControls}>
            <TouchableOpacity
              style={[styles.stepBtn, sensitivity <= 10 && styles.stepBtnDisabled]}
              onPress={decreaseSensitivity}
              disabled={sensitivity <= 10}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>

            {/* Visual track */}
            <View style={styles.trackBg}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${((sensitivity - 10) / 70) * 100}%` },
                ]}
              />
            </View>

            <TouchableOpacity
              style={[styles.stepBtn, sensitivity >= 80 && styles.stepBtnDisabled]}
              onPress={increaseSensitivity}
              disabled={sensitivity >= 80}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sensitivityHints}>
            <Text style={styles.hintText}>{t('settings_low')}</Text>
            <Text style={styles.hintText}>{t('settings_high')}</Text>
          </View>
        </View>

        {/* Units */}
        <View style={styles.card}>
          <Text style={styles.settingLabel}>{t('settings_units')}</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.unitBtn, units === 'metric' && styles.unitBtnActive]}
              onPress={() => setUnits('metric')}
            >
              <Text style={[styles.unitBtnText, units === 'metric' && styles.unitBtnTextActive]}>
                km/h
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitBtn, units === 'imperial' && styles.unitBtnActive]}
              onPress={() => setUnits('imperial')}
            >
              <Text
                style={[styles.unitBtnText, units === 'imperial' && styles.unitBtnTextActive]}
              >
                mph
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sound */}
        <View style={[styles.card, styles.switchCard]}>
          <Text style={styles.settingLabel}>{t('settings_sound')}</Text>
          <Switch
            value={sound}
            onValueChange={setSound}
            trackColor={{ false: colors.surface2, true: colors.accentGlow }}
            thumbColor={sound ? colors.accent : colors.textMuted}
          />
        </View>

        {/* Haptics */}
        <View style={[styles.card, styles.switchCard]}>
          <Text style={styles.settingLabel}>{t('settings_haptics')}</Text>
          <Switch
            value={haptics}
            onValueChange={setHaptics}
            trackColor={{ false: colors.surface2, true: colors.accentGlow }}
            thumbColor={haptics ? colors.accent : colors.textMuted}
          />
        </View>

      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    padding: 16,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  // Sensitivity
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sensitivityValue: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  sensitivityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  stepBtnText: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '600',
  },
  trackBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  sensitivityHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  hintText: {
    color: colors.textDim,
    fontSize: 11,
  },
  // Units
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface2,
    alignItems: 'center',
  },
  unitBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  unitBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  unitBtnTextActive: {
    color: colors.text,
  },
});
