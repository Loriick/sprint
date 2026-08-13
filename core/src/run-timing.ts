import type { CrossingEvent, RunPhase, RunResult, StartMode } from './types.ts';

export interface RunTimerOptions {
  /** 'auto' : le départ est détecté par la caméra. 'go' : c'est le bip. */
  startMode: StartMode;
  /**
   * Durée minimale d'un sprint. Un franchissement d'arrivée plus précoce est
   * le mouvement de départ qui a bavé dans la ROI d'arrivée, pas une arrivée.
   */
  minRunMs: number;
  /**
   * Fenêtre après le GO pendant laquelle on attend un départ détecté. Passé ce
   * délai, on retombe sur l'instant du GO plutôt que de perdre l'essai.
   */
  startWindowMs: number;
  /** Abandon si rien ne franchit jamais la ligne d'arrivée. */
  maxRunMs: number;
}

export const DEFAULT_RUN_TIMER_OPTIONS: RunTimerOptions = {
  startMode: 'auto',
  minRunMs: 800,
  startWindowMs: 4000,
  maxRunMs: 60_000,
};

/**
 * Machine à états d'un sprint.
 *
 *   idle → countdown → armed → running → done
 *
 * En mode auto, `armed` attend que l'athlète bouge : le chrono ne démarre qu'à
 * ce moment, si bien que le temps mesuré est celui de la course et non celui de
 * la course plus le temps de réaction au bip.
 */
export class RunTimer {
  private readonly opts: RunTimerOptions;

  private phaseValue: RunPhase = 'idle';
  private goTimeMs = 0;
  private startTimeMs = 0;
  private finishTimeMs: number | null = null;
  private effectiveStartMode: StartMode = 'go';
  private resultValue: RunResult | null = null;

  constructor(options: Partial<RunTimerOptions> = {}) {
    this.opts = { ...DEFAULT_RUN_TIMER_OPTIONS, ...options };
  }

  get phase(): RunPhase {
    return this.phaseValue;
  }

  get result(): RunResult | null {
    return this.resultValue;
  }

  /** Mode de départ réellement appliqué à l'essai en cours. */
  get startMode(): StartMode {
    return this.effectiveStartMode;
  }

  /** Instant de départ retenu, valable dès la phase `running`. */
  get startTime(): number {
    return this.startTimeMs;
  }

  reset(): void {
    this.phaseValue = 'idle';
    this.goTimeMs = 0;
    this.startTimeMs = 0;
    this.finishTimeMs = null;
    this.effectiveStartMode = 'go';
    this.resultValue = null;
  }

  beginCountdown(): void {
    this.reset();
    this.phaseValue = 'countdown';
  }

  /** Le bip GO vient d'être émis, à `timeMs` sur l'horloge de capture. */
  go(timeMs: number): void {
    this.goTimeMs = timeMs;

    if (this.opts.startMode === 'auto') {
      this.phaseValue = 'armed';
      return;
    }

    this.startTimeMs = timeMs;
    this.effectiveStartMode = 'go';
    this.phaseValue = 'running';
  }

  /**
   * Franchissement sur la ROI de départ.
   * @returns true si le départ a été retenu.
   */
  onStartCrossing(event: CrossingEvent): boolean {
    if (this.phaseValue !== 'armed') return false;

    this.startTimeMs = event.timeMs;
    this.effectiveStartMode = 'auto';
    this.phaseValue = 'running';
    return true;
  }

  /**
   * Franchissement sur la ROI d'arrivée.
   * @returns true si l'arrivée a été retenue et le sprint clos.
   */
  onFinishCrossing(event: CrossingEvent): boolean {
    if (this.phaseValue !== 'running') return false;
    if (event.timeMs - this.startTimeMs < this.opts.minRunMs) return false;

    this.finishTimeMs = event.timeMs;
    this.phaseValue = 'done';
    this.resultValue = {
      outcome: 'finished',
      timeMs: event.timeMs - this.startTimeMs,
      startMode: this.effectiveStartMode,
      startTimeMs: this.startTimeMs,
      finishTimeMs: event.timeMs,
    };
    return true;
  }

  /**
   * À appeler régulièrement pour faire jouer les délais de garde.
   * @returns le résultat si le sprint vient de se clore sur un délai.
   */
  tick(nowMs: number): RunResult | null {
    if (this.phaseValue === 'armed' && nowMs - this.goTimeMs >= this.opts.startWindowMs) {
      // Départ jamais détecté : on garde l'essai en repartant du bip, quitte à
      // mesurer aussi le temps de réaction. Le résultat porte la mention.
      this.startTimeMs = this.goTimeMs;
      this.effectiveStartMode = 'go';
      this.phaseValue = 'running';
      return null;
    }

    if (this.phaseValue === 'running' && nowMs - this.startTimeMs >= this.opts.maxRunMs) {
      this.phaseValue = 'done';
      this.resultValue = {
        outcome: 'timeout',
        timeMs: null,
        startMode: this.effectiveStartMode,
        startTimeMs: this.startTimeMs,
        finishTimeMs: null,
      };
      return this.resultValue;
    }

    return null;
  }

  cancel(): RunResult {
    this.phaseValue = 'done';
    this.resultValue = {
      outcome: 'cancelled',
      timeMs: null,
      startMode: this.effectiveStartMode,
      startTimeMs: this.startTimeMs,
      finishTimeMs: null,
    };
    return this.resultValue;
  }

  /** Temps écoulé à afficher, en ms. 0 tant que le départ n'est pas constaté. */
  elapsedAt(nowMs: number): number {
    if (this.phaseValue === 'running') return Math.max(0, nowMs - this.startTimeMs);
    if (this.phaseValue === 'done' && this.resultValue?.timeMs != null) {
      return this.resultValue.timeMs;
    }
    return 0;
  }
}
