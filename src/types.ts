export type Phase = 'idle' | 'countdown' | 'running' | 'done';

export interface AppState {
  distance: number;
  sensitivity: number;
  phase: Phase;
  startTime: number;
  elapsed: number;
  timerRaf: number | null;
  prevFrame: ImageData | null;
  stream: MediaStream | null;
}

export interface HistoryEntry {
  id: string;
  dist: number;
  timeMs: number;
  date: number;
}

export type ScreenName = 'home' | 'camera' | 'result' | 'settings' | 'history';
export type RouteParams = Record<string, string>;
export type RouteHandler = (params: RouteParams) => void;
