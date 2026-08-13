// Noyau partagé PWA / Expo. Aucune dépendance au DOM ni à React Native :
// on reçoit des pixels et des timestamps, on renvoie des événements.

/** Zone d'intérêt, en coordonnées normalisées 0..1 relatives au cadre. */
export interface Roi {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Un plan de pixels prêt à analyser, tel que le produit chaque plateforme. */
export interface FrameBuffer {
  /** RGB ou RGBA entrelacé, une valeur par canal et par pixel. */
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  /** 3 pour du RGB, 4 pour du RGBA. */
  channels: 3 | 4;
}

/** Franchissement détecté sur une ROI. */
export interface CrossingEvent {
  /** Instant estimé du franchissement, en ms sur l'horloge de capture. */
  timeMs: number;
  /** Énergie au moment du déclenchement, en niveaux 0..255. */
  energy: number;
  /**
   * true si l'instant a été affiné entre deux frames, false s'il correspond
   * exactement au timestamp d'une frame (premier échantillon utilisable).
   */
  interpolated: boolean;
}

export type StartMode = 'go' | 'auto';

export type RunPhase = 'idle' | 'countdown' | 'armed' | 'running' | 'done';

/** Pourquoi un sprint s'est terminé. */
export type RunOutcome = 'finished' | 'timeout' | 'cancelled';

export interface RunResult {
  outcome: RunOutcome;
  /** Durée mesurée en ms, null si le sprint n'a pas abouti. */
  timeMs: number | null;
  /** Mode de départ réellement utilisé — 'go' si le départ auto a échoué. */
  startMode: StartMode;
  startTimeMs: number;
  finishTimeMs: number | null;
}

export interface HistoryEntry {
  id: string;
  dist: number;
  timeMs: number;
  date: number;
  /** Absent sur les entrées créées avant le départ auto : elles valent 'go'. */
  startMode?: StartMode;
}

export type Lang = 'fr' | 'en';
export type Units = 'metric' | 'imperial';
