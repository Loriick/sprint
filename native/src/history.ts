import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from './store';
import type { HistoryEntry } from './types';

const HISTORY_KEY = 'history';

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: HistoryEntry[] = JSON.parse(raw || '[]');
    let dirty = false;
    for (const h of history) {
      if (!h.id) {
        h.id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        dirty = true;
      }
    }
    if (dirty) await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return history;
  } catch {
    return [];
  }
}

export async function saveResult(dist: number, timeMs: number): Promise<void> {
  const history = await getHistory();
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  history.unshift({ id, dist, timeMs, date: Date.now() });
  if (history.length > 50) history.length = 50;
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export async function deleteResult(id: string): Promise<void> {
  const history = (await getHistory()).filter((h) => h.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2) + 's';
}

export function speedKmh(dist: number, timeMs: number): number {
  const meters = dist * 0.9144;
  const mps = meters / (timeMs / 1000);
  return mps * 3.6;
}

export function speedMph(dist: number, timeMs: number): number {
  const meters = dist * 0.9144;
  const mps = meters / (timeMs / 1000);
  return mps * 2.23694;
}

export function speedForUnits(dist: number, timeMs: number): number {
  return useStore.getState().units === 'imperial'
    ? speedMph(dist, timeMs)
    : speedKmh(dist, timeMs);
}

export function speedUnitLabel(): string {
  return useStore.getState().units === 'imperial' ? 'mph' : 'km/h';
}

export async function getBest(dist: number): Promise<number | null> {
  const times = (await getHistory()).filter((h) => h.dist === dist).map((h) => h.timeMs);
  return times.length ? Math.min(...times) : null;
}

export async function getStatsForDistance(
  dist: number,
): Promise<{ best: number | null; avg: number | null; count: number }> {
  const times = (await getHistory()).filter((h) => h.dist === dist).map((h) => h.timeMs);
  if (!times.length) return { best: null, avg: null, count: 0 };
  return {
    best: Math.min(...times),
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    count: times.length,
  };
}
