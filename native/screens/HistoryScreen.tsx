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
import type { HistoryEntry } from '../src/types';

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
  History: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const DISTANCES = [10, 20, 30, 40] as const;

// ---------------------------------------------------------------------------
// HistoryScreen
// ---------------------------------------------------------------------------
export default function HistoryScreen({ navigation }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<number | null>(null); // null = All
  const [stats, setStats] = useState<{ best: number | null; avg: number | null; count: number }>({
    best: null,
    avg: null,
    count: 0,
  });

  const load = useCallback(async () => {
    const all = await getHistory();
    setEntries(all);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === null) {
      // Aggregate stats across all distances
      if (entries.length === 0) {
        setStats({ best: null, avg: null, count: 0 });
        return;
      }
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

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(t('delete_title'), t('delete_message'), [
        { text: t('delete_cancel'), style: 'cancel' },
        {
          text: t('delete_confirm'),
          style: 'destructive',
          onPress: async () => {
            await deleteResult(id);
            await load();
          },
        },
      ]);
    },
    [load],
  );

  // -------------------------------------------------------------------------
  // Chart data
  // -------------------------------------------------------------------------
  const chartData = filtered.slice(0, 20).reverse(); // oldest → newest, cap 20
  const maxSpeed =
    chartData.length > 0
      ? Math.max(...chartData.map((e) => speedForUnits(e.dist, e.timeMs)))
      : 1;
  const bestTimeMs = stats.best;

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderItem = ({ item }: { item: HistoryEntry }) => {
    const isPB = item.timeMs === bestTimeMs;
    const speed = speedForUnits(item.dist, item.timeMs).toFixed(1);
    const label = speedUnitLabel();
    const dateStr = new Date(item.date).toLocaleDateString();

    return (
      <View style={[styles.card, isPB && styles.cardPB]}>
        {/* Left */}
        <View style={styles.cardLeft}>
          <Text style={styles.distLabel}>{item.dist} yd</Text>
          <Text style={styles.dateLabel}>{dateStr}</Text>
        </View>

        {/* Center */}
        <Text style={styles.timeText}>{formatTime(item.timeMs)}</Text>

        {/* Right */}
        <View style={styles.cardRight}>
          <Text style={styles.speedLabel}>
            {speed} {label}
          </Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ListHeader = (
    <>
      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('history_stat_best')}</Text>
          <Text style={styles.statValue}>{stats.best ? formatTime(stats.best) : '–'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('history_stat_avg')}</Text>
          <Text style={styles.statValue}>{stats.avg ? formatTime(stats.avg) : '–'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('history_stat_count')}</Text>
          <Text style={styles.statValue}>{stats.count}</Text>
        </View>
      </View>

      {/* Progress chart */}
      {chartData.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>
            {t('history_chart_title')}{' '}
            <Text style={styles.chartCaption}>({t('history_chart_caption')})</Text>
          </Text>
          <View style={styles.chartBars}>
            {chartData.map((entry, i) => {
              const speed = speedForUnits(entry.dist, entry.timeMs);
              const ratio = speed / maxSpeed;
              const barH = Math.max(8, Math.round(ratio * 60));
              const isBest = entry.timeMs === bestTimeMs;
              return (
                <View key={entry.id} style={styles.barWrapper}>
                  <Text style={styles.barTimeLabel}>{(entry.timeMs / 1000).toFixed(1)}</Text>
                  <View
                    style={[
                      styles.bar,
                      { height: barH },
                      isBest ? styles.barBest : styles.barNormal,
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Divider */}
      <View style={styles.divider} />
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{t('history_back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('history_title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {/* "All" tab */}
        <TouchableOpacity
          style={[styles.tab, tab === null && styles.tabActive]}
          onPress={() => setTab(null)}
        >
          <Text style={[styles.tabText, tab === null && styles.tabTextActive]}>
            {t('history_tab_all')}
          </Text>
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

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('history_empty')}</Text>
          </View>
        }
      />
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
  // Header
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
  // Tabs
  tabsScroll: {
    maxHeight: 48,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  tabActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(139,92,246,0.10)',
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.accent,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  // Chart
  chartContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    padding: 12,
  },
  chartTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  chartCaption: {
    color: colors.textDim,
    fontWeight: '400',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 4,
  },
  barWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  barTimeLabel: {
    color: colors.textDim,
    fontSize: 8,
    marginBottom: 2,
  },
  bar: {
    width: '80%',
    borderRadius: 3,
    minHeight: 4,
  },
  barNormal: {
    backgroundColor: colors.surface2,
  },
  barBest: {
    backgroundColor: colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  // List
  listContent: {
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardPB: {
    borderColor: colors.accent,
  },
  cardLeft: {
    flex: 1,
  },
  distLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  dateLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  timeText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginHorizontal: 12,
  },
  cardRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 6,
  },
  speedLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  // Empty
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
