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
