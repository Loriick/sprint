import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useStore } from '../src/store';
import { getHistory, formatTime } from '../src/history';
import { t } from '../src/i18n';
import { colors, spacing, radius, shadow } from '../src/theme';
import AuroraBackground from '../src/components/AuroraBackground';
import GlassCard from '../src/components/GlassCard';
import type { RootStackParamList } from '../App';
import type { HistoryEntry } from '../src/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const DISTANCES = [10, 20, 30, 40];

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const distance = useStore((s) => s.distance);
  const setDistance = useStore((s) => s.setDistance);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback(async () => {
    const entries = await getHistory();
    setHistory(entries.slice(0, 5));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

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
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.langRow}>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'fr' && styles.langBtnActive]}
                onPress={() => setLang('fr')}
                activeOpacity={0.7}
              >
                <Text style={[styles.langText, lang === 'fr' && styles.langTextActive]}>
                  FR
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
                onPress={() => setLang('en')}
                activeOpacity={0.7}
              >
                <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>
                  EN
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsIcon}>⚙</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Sprint⚡Timer</Text>
          </View>

          {/* Distance picker */}
          <Text style={styles.sectionLabel}>{t('home_kicker', lang)}</Text>
          <View style={styles.distanceRow}>
            {DISTANCES.map((d) => {
              const active = d === distance;
              return active ? (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDistance(d)}
                  activeOpacity={0.85}
                  style={styles.distBtnWrap}
                >
                  <LinearGradient
                    colors={[colors.accent, colors.accentPink]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.distBtn, styles.distBtnActive, shadow.accent]}
                  >
                    <Text style={styles.distBtnTextActive}>{d}</Text>
                    <Text style={styles.distBtnUnit}>yd</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDistance(d)}
                  activeOpacity={0.7}
                  style={styles.distBtnWrap}
                >
                  <GlassCard style={styles.distBtn}>
                    <Text style={styles.distBtnText}>{d}</Text>
                    <Text style={styles.distBtnUnit}>yd</Text>
                  </GlassCard>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* START button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Camera')}
            activeOpacity={0.85}
            style={styles.startWrap}
          >
            <LinearGradient
              colors={[colors.accent, colors.accentPink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.startBtn, shadow.accent]}
            >
              <Text style={styles.startText}>{t('home_start', lang)}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Recent history */}
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>{t('home_recent', lang)}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
              <Text style={styles.seeAll}>{t('home_seeall', lang)}</Text>
            </TouchableOpacity>
          </View>

          {history.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('home_empty_history', lang)}</Text>
            </GlassCard>
          ) : (
            history.map((entry) => (
              <GlassCard key={entry.id} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <View style={styles.historyDistWrap}>
                    <Text style={styles.historyDist}>{entry.dist}</Text>
                    <Text style={styles.historyDistUnit}>yd</Text>
                  </View>
                  <Text style={styles.historyTime}>{formatTime(entry.timeMs)}</Text>
                  <Text style={styles.historyDate}>{formatDate(entry.date)}</Text>
                </View>
              </GlassCard>
            ))
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  langRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 3,
    gap: 2,
  },
  langBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  langBtnActive: {
    backgroundColor: colors.accent,
  },
  langText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  langTextActive: {
    color: colors.onAccent,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
    color: colors.textMuted,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 2,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  distanceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  distBtnWrap: {
    flex: 1,
  },
  distBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    minHeight: 72,
  },
  distBtnActive: {
    borderWidth: 0,
  },
  distBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textMuted,
  },
  distBtnTextActive: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.onAccent,
  },
  distBtnUnit: {
    fontSize: 11,
    color: colors.textDim,
    fontWeight: '500',
    marginTop: 2,
  },
  startWrap: {
    marginBottom: spacing.xl,
  },
  startBtn: {
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.onAccent,
    letterSpacing: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  seeAll: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  historyCard: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyDistWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    width: 64,
  },
  historyDist: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent,
  },
  historyDistUnit: {
    fontSize: 12,
    color: colors.textDim,
    fontWeight: '500',
  },
  historyTime: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  historyDate: {
    fontSize: 13,
    color: colors.textMuted,
    width: 64,
    textAlign: 'right',
  },
  emptyCard: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  bottomPad: {
    height: spacing.xl,
  },
});
