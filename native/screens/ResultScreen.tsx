import React, { useEffect, useState } from 'react';
import {
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  formatTime,
  getBest,
  saveResult,
  speedKmh,
  speedMph,
} from '../src/history';
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
  Camera: undefined;
  Result: { ms: number; distance: number };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

// ---------------------------------------------------------------------------
// ResultScreen
// ---------------------------------------------------------------------------
export default function ResultScreen({ navigation, route }: Props) {
  const { ms, distance } = route.params;
  const units = useStore((s) => s.units);

  const [prevBest, setPrevBest] = useState<number | null>(null);
  const [isPB, setIsPB] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Load previous best BEFORE saving
      const best = await getBest(distance);
      if (cancelled) return;
      setPrevBest(best);

      // Determine PB
      const isNewBest = best === null || ms < best;
      setIsPB(isNewBest);

      // Save result
      await saveResult(distance, ms);
      if (!cancelled) setSaved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [distance, ms]);

  // Speed values
  const speedKm = speedKmh(distance, ms);
  const speedMp = speedMph(distance, ms);
  const primarySpeed = units === 'imperial' ? speedMp : speedKm;
  const secondarySpeed = units === 'imperial' ? speedKm : speedMp;
  const primaryLabel = units === 'imperial' ? 'mph' : 'km/h';
  const secondaryLabel = units === 'imperial' ? 'km/h' : 'mph';

  // Delta vs record
  const deltaMs = prevBest !== null ? ms - prevBest : null;
  const deltaSeconds = deltaMs !== null ? (deltaMs / 1000).toFixed(2) : null;
  const deltaFaster = deltaMs !== null && deltaMs < 0;

  // Share handler
  const handleShare = async () => {
    const msg = `${distance} yards — ${formatTime(ms)} (${primarySpeed.toFixed(1)} ${primaryLabel})`;
    try {
      await Share.share({ message: msg });
    } catch {
      // silently ignore
    }
  };

  return (
    <View style={styles.root}>
      {/* Aurora background */}
      <LinearGradient
        colors={['#08080F', 'rgba(139,92,246,0.15)', '#08080F']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Distance label */}
        <Text style={styles.distanceLabel}>{distance} YARDS</Text>

        {/* PB pill */}
        {isPB && (
          <LinearGradient
            colors={[colors.accent, colors.accentPink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pbPill}
          >
            <Text style={styles.pbText}>{t('result_pb')}</Text>
          </LinearGradient>
        )}

        {/* Main timer */}
        <Text style={styles.mainTimer}>{formatTime(ms)}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {/* Speed card */}
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>{t('result_speed')}</Text>
            <Text style={styles.statCardValue}>
              {primarySpeed.toFixed(1)}{' '}
              <Text style={styles.statCardUnit}>{primaryLabel}</Text>
            </Text>
            <Text style={styles.statCardSecondary}>
              {secondarySpeed.toFixed(1)} {secondaryLabel}
            </Text>
          </View>

          {/* vs Record card */}
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>{t('result_vsbest')}</Text>
            {deltaSeconds !== null ? (
              <Text
                style={[
                  styles.statCardValue,
                  deltaFaster ? styles.fasterText : styles.slowerText,
                ]}
              >
                {deltaFaster ? '↓' : '↑'} {Math.abs(Number(deltaSeconds)).toFixed(2)}s
              </Text>
            ) : (
              <Text style={[styles.statCardValue, styles.fasterText]}>–</Text>
            )}
            {prevBest !== null && (
              <Text style={styles.statCardSecondary}>
                {t('result_record')} {formatTime(prevBest)}
              </Text>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {/* Primary: Retry */}
          <LinearGradient
            colors={[colors.accent, colors.accentPink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtnGradient}
          >
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Camera')}
            >
              <Text style={styles.primaryBtnText}>↺ {t('result_retry_label')}</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Secondary row */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare}>
              <Text style={styles.secondaryBtnText}>↑ {t('result_share_label')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.secondaryBtnText}>← {t('result_home_label')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  distanceLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  pbPill: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginBottom: 16,
  },
  pbText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mainTimer: {
    color: colors.text,
    fontSize: 80,
    fontWeight: '800',
    letterSpacing: -2,
    marginBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 40,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statCardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statCardValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  statCardUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  statCardSecondary: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 4,
  },
  fasterText: {
    color: colors.accent,
  },
  slowerText: {
    color: colors.danger,
  },
  // Actions
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtnGradient: {
    borderRadius: 16,
  },
  primaryBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
