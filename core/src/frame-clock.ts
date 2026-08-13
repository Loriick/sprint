/**
 * Conversion des timestamps de capture en millisecondes.
 *
 * Le timestamp qu'expose une frame caméra n'a pas la même unité selon la
 * plateforme et la version de la bibliothèque : nanosecondes, microsecondes,
 * millisecondes ou secondes selon les cas. Plutôt que de coder en dur une
 * hypothèse, on déduit l'échelle en comparant la progression des timestamps
 * bruts à celle de l'horloge murale sur les premières frames. Les deux mesurent
 * la même durée réelle : leur rapport donne le facteur de conversion, qu'on
 * arrondit à la puissance de mille la plus proche.
 *
 * Ce qui compte pour le chronométrage, c'est que deux frames soient horodatées
 * sur la même base : la latence du pipeline caméra décale l'origine mais
 * s'annule dans la différence entre un départ et une arrivée tous deux
 * détectés par la caméra.
 */

const CANDIDATE_SCALES = [1e-6, 1e-3, 1, 1e3];
const DEFAULT_CALIBRATION_FRAMES = 24;

export class FrameClock {
  private readonly calibrationFrames: number;

  private firstRaw = 0;
  private firstWallMs = 0;
  private framesSeen = 0;
  private scaleValue = 1;
  private calibratedValue = false;
  private fallback = false;

  constructor(calibrationFrames = DEFAULT_CALIBRATION_FRAMES) {
    this.calibrationFrames = calibrationFrames;
  }

  get calibrated(): boolean {
    return this.calibratedValue;
  }

  /** true si les timestamps bruts se sont révélés inutilisables. */
  get usingFallback(): boolean {
    return this.fallback;
  }

  /** Facteur appliqué aux timestamps bruts pour obtenir des millisecondes. */
  get scale(): number {
    return this.scaleValue;
  }

  reset(): void {
    this.firstRaw = 0;
    this.firstWallMs = 0;
    this.framesSeen = 0;
    this.scaleValue = 1;
    this.calibratedValue = false;
    this.fallback = false;
  }

  /**
   * @param rawTimestamp timestamp tel que fourni par la frame
   * @param wallMs horloge murale au moment où la frame est traitée
   * @returns instant de capture en ms, comparable d'une frame à l'autre
   */
  push(rawTimestamp: number, wallMs: number): number {
    if (!isFinite(rawTimestamp) || rawTimestamp <= 0) {
      this.fallback = true;
      this.calibratedValue = true;
      return wallMs;
    }

    if (this.framesSeen === 0) {
      this.firstRaw = rawTimestamp;
      this.firstWallMs = wallMs;
      this.framesSeen = 1;
      return wallMs;
    }

    this.framesSeen++;

    if (!this.calibratedValue) {
      if (this.framesSeen < this.calibrationFrames) {
        return wallMs;
      }

      const rawSpan = rawTimestamp - this.firstRaw;
      const wallSpan = wallMs - this.firstWallMs;

      if (rawSpan <= 0 || wallSpan <= 0) {
        // Timestamps figés ou qui reculent : inexploitables.
        this.fallback = true;
        this.calibratedValue = true;
        return wallMs;
      }

      this.scaleValue = nearestScale(wallSpan / rawSpan);
      this.calibratedValue = true;
    }

    if (this.fallback) return wallMs;

    return this.firstWallMs + (rawTimestamp - this.firstRaw) * this.scaleValue;
  }
}

/** Puissance de mille la plus proche du rapport observé, en échelle log. */
export function nearestScale(ratio: number): number {
  let best = CANDIDATE_SCALES[0];
  let bestErr = Infinity;
  for (const candidate of CANDIDATE_SCALES) {
    const err = Math.abs(Math.log(ratio / candidate));
    if (err < bestErr) {
      bestErr = err;
      best = candidate;
    }
  }
  return best;
}
