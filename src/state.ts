import type { AppState, Lang } from './types';

const storedLang = localStorage.getItem('lang');
const lang: Lang = storedLang === 'en' ? 'en' : 'fr';

export const state: AppState = {
  distance: 10,
  sensitivity: parseInt(localStorage.getItem('sensitivity') || '30'),
  phase: 'idle',
  startTime: 0,
  elapsed: 0,
  timerRaf: null,
  prevFrame: null,
  stream: null,
  lang,
};
