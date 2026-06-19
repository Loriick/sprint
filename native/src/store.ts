import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, Lang, Units, Phase } from './types';

interface AppStore extends AppState {
  setDistance: (d: number) => void;
  setSensitivity: (s: number) => void;
  setCountdownDuration: (n: number) => void;
  setLang: (l: Lang) => void;
  setUnits: (u: Units) => void;
  setSound: (v: boolean) => void;
  setHaptics: (v: boolean) => void;
  setPhase: (p: Phase) => void;
  setStartTime: (t: number) => void;
  setElapsed: (ms: number) => void;
  loadPersistedSettings: () => Promise<void>;
}

export const useStore = create<AppStore>((set) => ({
  distance: 40,
  sensitivity: 30,
  countdownDuration: 3,
  phase: 'idle',
  startTime: 0,
  elapsed: 0,
  lang: 'en',
  units: 'metric',
  sound: true,
  haptics: true,

  setDistance: (d) => set({ distance: d }),
  setSensitivity: (s) => set({ sensitivity: s }),
  setCountdownDuration: (n) => set({ countdownDuration: n }),

  setLang: (l) => {
    set({ lang: l });
    AsyncStorage.setItem('lang', l).catch(() => {});
  },

  setUnits: (u) => {
    set({ units: u });
    AsyncStorage.setItem('units', u).catch(() => {});
  },

  setSound: (v) => {
    set({ sound: v });
    AsyncStorage.setItem('sound', String(v)).catch(() => {});
  },

  setHaptics: (v) => {
    set({ haptics: v });
    AsyncStorage.setItem('haptics', String(v)).catch(() => {});
  },

  setPhase: (p) => set({ phase: p }),
  setStartTime: (t) => set({ startTime: t }),
  setElapsed: (ms) => set({ elapsed: ms }),

  loadPersistedSettings: async () => {
    try {
      const [lang, units, sound, haptics] = await Promise.all([
        AsyncStorage.getItem('lang'),
        AsyncStorage.getItem('units'),
        AsyncStorage.getItem('sound'),
        AsyncStorage.getItem('haptics'),
      ]);
      set({
        ...(lang ? { lang: lang as Lang } : {}),
        ...(units ? { units: units as Units } : {}),
        ...(sound !== null ? { sound: sound === 'true' } : {}),
        ...(haptics !== null ? { haptics: haptics === 'true' } : {}),
      });
    } catch {
      // silently ignore — defaults remain
    }
  },
}));
