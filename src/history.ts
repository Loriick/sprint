import type { HistoryEntry } from './types';

export function getHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem('history') || '[]'); }
  catch { return []; }
}

export function saveResult(dist: number, timeMs: number): void {
  const history = getHistory();
  const id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
  history.unshift({ id, dist, timeMs, date: Date.now() });
  if (history.length > 50) history.length = 50;
  localStorage.setItem('history', JSON.stringify(history));
}

export function deleteResult(id: string): void {
  const history = getHistory().filter((h) => h.id !== id);
  localStorage.setItem('history', JSON.stringify(history));
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

export function getBest(dist: number): number | null {
  const times = getHistory().filter((h) => h.dist === dist).map((h) => h.timeMs);
  return times.length ? Math.min(...times) : null;
}

export function getStatsForDistance(dist: number): { best: number | null; avg: number | null; count: number } {
  const times = getHistory().filter((h) => h.dist === dist).map((h) => h.timeMs);
  if (!times.length) return { best: null, avg: null, count: 0 };
  return {
    best: Math.min(...times),
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    count: times.length,
  };
}
