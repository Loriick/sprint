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
import { colors, spacing, radius, shadow } from '../src/theme';
import AuroraBackground from '../src/components/AuroraBackground';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: { ms: number; distance: number };
};

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ navigation, route }: Props) {
  const { ms, distance } = route.params;
  const units = useStore((s) => s.units);

  const [prevBest, setPrevBest] = useState<number | null>(null);
  const [isPB, setIsPB] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const best = await getBest(distance);
      if (cancelled) return;
      setPrevBest(best);
      setIsPB(best === null || ms < best);
      await saveResult(distance, ms);
    })();
    return () => { cancelled = true; };
  }, [distance, ms]);

  const speedKm = speedKmh(distance, ms);
  const speedMp = speedMph(distance, ms);
  const primarySpeed = units === 'imperial' ? speedMp : speedKm;
  const secondarySpeed = units === 'imperial' ? speedKm : speedMp;
  const primaryLabel = units === 'imperial' ? 'mph' : 'km/h';
  const secondaryLabel = units === 'imperial' ? 'km/h' : 'mph';

  const deltaMs = prevBest !== null ? ms - prevBest : null;
  const deltaSeconds = deltaMs !== null ? (Math.abs(deltaMs) / 1000).toFixed(2) : null;
  const deltaFaster = deltaMs !== null && deltaMs < 0;

  const handleShare = async () => {
    const msg = `${distance} yards — ${formatTime(ms)} (${primarySpeed.toFixed(1)} ${primaryLabel}) 🏃‍♂️`;
    try { await Share.share({ message: msg }); } catch { /* ignore */ }
  };

  return (
    <View style={styles.root}>
      <AuroraBackground />

      <SafeAreaView style={styles.safeArea}>

        {/* Kicker */}
        <Text style={styles.kicker}>{distance} YARDS</Text>

        {/* PB badge */}
        {isPB && (
          <View style={styles.pbBadge}>
            <LinearGradient
              colors={[colors.accent, '#00BFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.pbGradient}
            >
              <Text style={styles.pbText}>✦ {t('result_pb')}</Text>
            </LinearGradient>
          </View>
        )}

        {/* Main time */}
        <View style={styles.timerBlock}>
          <Text style={styles.mainTimer}>{formatTime(ms)}</Text>
          <Text style={styles.timerSub}>secondes</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('result_speed')}</Text>
            <Text style={styles.statValue}>{primarySpeed.toFixed(1)}</Text>
            <Text style={styles.statUnit}>{primaryLabel}</Text>
            <Text style={styles.statSub}>{secondarySpeed.toFixed(1)} {secondaryLabel}</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('result_vsbest')}</Text>
            {deltaSeconds !== null ? (
              <>
                <Text style={[styles.statValue, deltaFaster ? styles.fasterText : styles.slowerText]}>
                  {deltaFaster ? '−' : '+'}{deltaSeconds}
                </Text>
                <Text style={styles.statUnit}>s</Text>
              </>
            ) : (
              <Text style={[styles.statValue, styles.fasterText]}>–</Text>
            )}
            {prevBest !== null && (
              <Text style={styles.statSub}>PB {formatTime(prevBest)}</Text>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Camera')}
            activeOpacity={0.85}
            style={styles.retryWrap}
          >
            <LinearGradient
              colors={[colors.accent, '#00BFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.retryBtn, shadow.accent]}
            >
              <Text style={styles.retryText}>↺  {t('result_retry_label')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare} activeOpacity={0.7}>
              <Text style={styles.secondaryText}>↑  {t('result_share_label')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryText}>⌂  {t('result_home_label')}</Text>
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },

  kicker: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },

  pbBadge: { marginBottom: spacing.md },
  pbGradient: {
    borderRadius: radius.full,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  pbText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.onAccent,
    letterSpacing: 1,
  },

  timerBlock: { alignItems: 'center', marginBottom: spacing.xl },
  mainTimer: {
    fontSize: 88,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
    textShadowColor: colors.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 32,
  },
  timerSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDim,
    letterSpacing: 2,
    marginTop: 4,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  statSub: {
    fontSize: 11,
    color: colors.textDim,
    marginTop: 4,
  },
  fasterText: { color: colors.accent },
  slowerText: { color: colors.hot },

  actions: { width: '100%', gap: 12 },
  retryWrap: {},
  retryBtn: {
    borderRadius: radius.xl,
    paddingVertical: 18,
    alignItems: 'center',
  },
  retryText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.onAccent,
    letterSpacing: 1,
  },
  secondaryRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
