import type { AppState, Lang, Units } from './types';

const storedLang = localStorage.getItem('lang');
const lang: Lang = storedLang === 'en' ? 'en' : 'fr';

const storedUnits = localStorage.getItem('units');
const units: Units = storedUnits === 'imperial' ? 'imperial' : 'metric';

export const state: AppState = {
  distance: 10,
  sensitivity: parseInt(localStorage.getItem('sensitivity') || '30'),
  countdownDuration: parseInt(localStorage.getItem('countdownDuration') || '5'),
  phase: 'idle',
  startTime: 0,
  elapsed: 0,
  timerRaf: null,
  prevFrame: null,
  stream: null,
  lang,
  units,
  sound: localStorage.getItem('sound') !== 'false',
  haptics: localStorage.getItem('haptics') !== 'false',
};
