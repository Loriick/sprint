import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  deleteResult,
  formatTime,
  getHistory,
  getStatsForDistance,
  speedForUnits,
  speedUnitLabel,
} from '../src/history';
import { t } from '../src/i18n';
import { colors, spacing, radius } from '../src/theme';
import AuroraBackground from '../src/components/AuroraBackground';
import type { HistoryEntry } from '../src/types';

type RootStackParamList = { Home: undefined; History: undefined };
type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const DISTANCES = [10, 20, 30, 40] as const;

export default function HistoryScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<number | null>(null);
  const [stats, setStats] = useState<{ best: number | null; avg: number | null; count: number }>({
    best: null, avg: null, count: 0,
  });

  const load = useCallback(async () => {
    const all = await getHistory();
    setEntries(all);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === null) {
      if (entries.length === 0) { setStats({ best: null, avg: null, count: 0 }); return; }
      const times = entries.map((e) => e.timeMs);
      setStats({
        best: Math.min(...times),
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        count: times.length,
      });
    } else {
      getStatsForDistance(tab).then(setStats);
    }
  }, [tab, entries]);

  const filtered = tab === null ? entries : entries.filter((e) => e.dist === tab);
  const chartData = filtered.slice(0, 20).reverse();
  const maxSpeed = chartData.length > 0 ? Math.max(...chartData.map((e) => speedForUnits(e.dist, e.timeMs))) : 1;
  const bestTimeMs = stats.best;

  const handleDelete = useCallback((id: string) => {
    Alert.alert(t('delete_title'), t('delete_message'), [
      { text: t('delete_cancel'), style: 'cancel' },
      { text: t('delete_confirm'), style: 'destructive', onPress: async () => { await deleteResult(id); await load(); } },
    ]);
  }, [load]);

  const renderItem = ({ item }: { item: HistoryEntry }) => {
    const isPB = item.timeMs === bestTimeMs;
    const speed = speedForUnits(item.dist, item.timeMs).toFixed(1);
    const label = speedUnitLabel();
    const dateStr = new Date(item.date).toLocaleDateString();

    return (
      <View style={[styles.card, isPB && styles.cardPB]}>
        <View style={styles.cardLeft}>
          <Text style={styles.distLabel}>{item.dist}<Text style={styles.distUnit}> yd</Text></Text>
          <Text style={styles.dateLabel}>{dateStr}</Text>
        </View>
        <Text style={[styles.timeText, isPB && styles.timePB]}>{formatTime(item.timeMs)}</Text>
        <View style={styles.cardRight}>
          {isPB && <Text style={styles.pbTag}>PB</Text>}
          <Text style={styles.speedLabel}>{speed} {label}</Text>
          <TouchableOpacity
            onPress={() => handleDelete(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ListHeader = (
    <>
      <View style={styles.statsRow}>
        {[
          { label: t('history_stat_best'), value: stats.best ? formatTime(stats.best) : '–' },
          { label: t('history_stat_avg'), value: stats.avg ? formatTime(stats.avg) : '–' },
          { label: t('history_stat_count'), value: String(stats.count) },
        ].map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statValue}>{s.value}</Text>
          </View>
        ))}
      </View>

      {chartData.length > 1 && (
        <View style={styles.chart}>
          <Text style={styles.chartTitle}>{t('history_chart_title')}</Text>
          <View style={styles.chartBars}>
            {chartData.map((entry) => {
              const speed = speedForUnits(entry.dist, entry.timeMs);
              const ratio = speed / maxSpeed;
              const barH = Math.max(6, Math.round(ratio * 56));
              const isBest = entry.timeMs === bestTimeMs;
              return (
                <View key={entry.id} style={styles.barWrap}>
                  <View style={[styles.bar, { height: barH }, isBest ? styles.barBest : styles.barNormal]} />
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.divider} />
    </>
  );

  return (
    <View style={styles.root}>
      <AuroraBackground />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('history_title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          <TouchableOpacity
            style={[styles.tab, tab === null && styles.tabActive]}
            onPress={() => setTab(null)}
          >
            <Text style={[styles.tabText, tab === null && styles.tabTextActive]}>{t('history_tab_all')}</Text>
          </TouchableOpacity>
          {DISTANCES.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.tab, tab === d && styles.tabActive]}
              onPress={() => setTab(d)}
            >
              <Text style={[styles.tabText, tab === d && styles.tabTextActive]}>{d} yd</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('history_empty')}</Text>
            </View>
          }
        />
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 28, color: colors.accent, fontWeight: '300', lineHeight: 32 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },

  tabsScroll: { maxHeight: 48, marginBottom: spacing.sm },
  tabsContent: {
    paddingHorizontal: spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.accentDim,
  },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.accent },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 10,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },

  chart: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    gap: 3,
  },
  barWrap: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  bar: { width: '70%', borderRadius: 3 },
  barNormal: { backgroundColor: colors.surfaceHigh },
  barBest: { backgroundColor: colors.accent },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  listContent: { paddingBottom: spacing.xxl },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  cardPB: { borderColor: colors.borderAccent },
  cardLeft: { flex: 1 },
  distLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  distUnit: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  dateLabel: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  timeText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginHorizontal: 10,
  },
  timePB: { color: colors.accent },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  pbTag: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  speedLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  deleteText: { fontSize: 13, color: colors.danger, fontWeight: '700', marginTop: 4 },

  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});
