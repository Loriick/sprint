export type Phase = 'idle' | 'countdown' | 'running' | 'done';
export type Lang = 'fr' | 'en';
export type Units = 'metric' | 'imperial';

export interface AppState {
  distance: number;
  sensitivity: number;
  countdownDuration: number;
  phase: Phase;
  startTime: number;
  elapsed: number;
  lang: Lang;
  units: Units;
  sound: boolean;
  haptics: boolean;
}

export interface HistoryEntry {
  id: string;
  dist: number;
  timeMs: number;
  date: number;
}

export type ScreenName = 'home' | 'camera' | 'result' | 'settings' | 'history';
