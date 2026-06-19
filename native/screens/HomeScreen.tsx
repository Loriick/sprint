import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useStore } from '../src/store';
import { getHistory, getBest, formatTime } from '../src/history';
import { t } from '../src/i18n';
import { colors, spacing, radius, shadow } from '../src/theme';
import AuroraBackground from '../src/components/AuroraBackground';
import type { RootStackParamList } from '../App';
import type { HistoryEntry } from '../src/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const DISTANCES = [10, 20, 30, 40];
const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const distance = useStore((s) => s.distance);
  const setDistance = useStore((s) => s.setDistance);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [best, setBest] = useState<number | null>(null);

  // ── Animations ──
  const slideX = useRef(new Animated.Value(0)).current;
  const numOpacity = useRef(new Animated.Value(1)).current;
  const startScale = useRef(new Animated.Value(1)).current;
  const startGlow = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    const entries = await getHistory();
    setHistory(entries.slice(0, 4));
    const b = await getBest(distance);
    setBest(b);
  }, [distance]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const distIdx = DISTANCES.indexOf(distance);

  function animateDistChange(newDist: number, dir: 'left' | 'right') {
    const outX = dir === 'right' ? -60 : 60;
    const inX = dir === 'right' ? 60 : -60;
    Animated.parallel([
      Animated.timing(slideX, { toValue: outX, duration: 100, useNativeDriver: true }),
      Animated.timing(numOpacity, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      setDistance(newDist);
      slideX.setValue(inX);
      Animated.parallel([
        Animated.spring(slideX, { toValue: 0, friction: 7, tension: 260, useNativeDriver: true }),
        Animated.timing(numOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    });
  }

  const prevDistance = () => {
    if (distIdx > 0) animateDistChange(DISTANCES[distIdx - 1], 'left');
  };

  const nextDistance = () => {
    if (distIdx < DISTANCES.length - 1) animateDistChange(DISTANCES[distIdx + 1], 'right');
  };

  const onStartPressIn = () => {
    Animated.parallel([
      Animated.spring(startScale, { toValue: 0.93, friction: 10, tension: 300, useNativeDriver: true }),
      Animated.timing(startGlow, { toValue: 1, duration: 100, useNativeDriver: false }),
    ]).start();
  };

  const onStartPressOut = () => {
    Animated.parallel([
      Animated.spring(startScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
      Animated.timing(startGlow, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  function formatDate(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: 'short',
    });
  }

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.langPill}>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'fr' && styles.langBtnActive]}
                onPress={() => setLang('fr')}
                activeOpacity={0.7}
              >
                <Text style={[styles.langText, lang === 'fr' && styles.langTextActive]}>FR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
                onPress={() => setLang('en')}
                activeOpacity={0.7}
              >
                <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>EN</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.logo}>SPRINT</Text>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <Text style={styles.iconBtnText}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Distance hero */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>{t('home_kicker', lang)}</Text>

            <View style={styles.distancePicker}>
              <TouchableOpacity
                style={[styles.arrowBtn, distIdx === 0 && styles.arrowBtnDisabled]}
                onPress={prevDistance}
                activeOpacity={0.6}
                disabled={distIdx === 0}
              >
                <Text style={styles.arrowText}>‹</Text>
              </TouchableOpacity>

              <Animated.View
                style={[styles.distanceCenter, { transform: [{ translateX: slideX }], opacity: numOpacity }]}
              >
                <Text style={styles.distanceNumber}>{distance}</Text>
                <Text style={styles.distanceUnit}>YARDS</Text>
              </Animated.View>

              <TouchableOpacity
                style={[styles.arrowBtn, distIdx === DISTANCES.length - 1 && styles.arrowBtnDisabled]}
                onPress={nextDistance}
                activeOpacity={0.6}
                disabled={distIdx === DISTANCES.length - 1}
              >
                <Text style={styles.arrowText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Distance dots */}
            <View style={styles.dots}>
              {DISTANCES.map((d) => (
                <TouchableOpacity key={d} onPress={() => setDistance(d)} activeOpacity={0.7}>
                  <View style={[styles.dot, d === distance && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Personal best for selected distance */}
            {best !== null ? (
              <View style={styles.pbRow}>
                <Text style={styles.pbLabel}>PB</Text>
                <Text style={styles.pbValue}>{formatTime(best)}</Text>
              </View>
            ) : (
              <Text style={styles.pbEmpty}>{t('home_empty_history', lang)}</Text>
            )}
          </View>

          {/* START */}
          <Animated.View style={[styles.startWrap, { transform: [{ scale: startScale }] }]}>
            <Animated.View style={[
              styles.startGlowRing,
              {
                opacity: startGlow,
                shadowOpacity: startGlow as unknown as number,
              },
            ]} />
            <TouchableOpacity
              onPress={() => navigation.navigate('Camera')}
              onPressIn={onStartPressIn}
              onPressOut={onStartPressOut}
              activeOpacity={1}
            >
              <LinearGradient
                colors={[colors.accent, '#00BFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startBtn}
              >
                <Text style={styles.startText}>{t('home_start', lang)}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Recent history */}
          {history.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('home_recent', lang)}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
                  <Text style={styles.seeAll}>{t('home_seeall', lang)}</Text>
                </TouchableOpacity>
              </View>

              {history.map((entry) => (
                <View key={entry.id} style={styles.historyRow}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyDist}>{entry.dist}<Text style={styles.historyUnit}> yd</Text></Text>
                    <Text style={styles.historyDate}>{formatDate(entry.date)}</Text>
                  </View>
                  <Text style={styles.historyTime}>{formatTime(entry.timeMs)}</Text>
                  <View style={styles.historyDivider} />
                </View>
              ))}
            </>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  langPill: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 2,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  langBtnActive: { backgroundColor: colors.accent },
  langText: { color: colors.textMuted, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  langTextActive: { color: colors.onAccent },
  logo: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16, color: colors.textMuted },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  distancePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  arrowBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtnDisabled: { opacity: 0.2 },
  arrowText: {
    fontSize: 32,
    color: colors.text,
    lineHeight: 36,
    fontWeight: '300',
  },
  distanceCenter: { alignItems: 'center', minWidth: 140 },
  distanceNumber: {
    fontSize: 96,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -4,
    lineHeight: 100,
    textShadowColor: colors.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  distanceUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 4,
    marginTop: 4,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textDim,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 20,
    borderRadius: 3,
  },
  pbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.md,
    backgroundColor: colors.accentDim,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  pbLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.5,
  },
  pbValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pbEmpty: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textDim,
  },

  // Start
  startWrap: { marginBottom: spacing.xl, position: 'relative' },
  startGlowRing: {
    position: 'absolute',
    inset: -8,
    borderRadius: radius.xl + 8,
    backgroundColor: 'transparent',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 0,
  },
  startBtn: {
    borderRadius: radius.xl,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.onAccent,
    letterSpacing: 4,
  },

  // History
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  seeAll: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    position: 'relative',
  },
  historyLeft: { flex: 1 },
  historyDist: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  historyUnit: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  historyDate: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 2,
  },
  historyTime: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  historyDivider: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
});
