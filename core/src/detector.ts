import type { CrossingEvent } from './types.ts';

export interface DetectorOptions {
  /** Nombre de colonnes du profil analysé. */
  profileSize: number;
  /** Seuil haut d'armement, en niveaux de luminance 0..255. */
  threshold: number;
  /** Rapport seuil bas / seuil haut, pour l'hystérésis. */
  releaseRatio: number;
  /** Frames au-dessus du seuil requises pour confirmer un franchissement. */
  requiredHits: number;
  /** Frames d'initialisation du fond avant toute détection. */
  warmupFrames: number;
  /** Coefficient d'adaptation du fond, par frame (0..1). */
  backgroundAlpha: number;
  /** Frames de montée d'énergie conservées pour extrapoler l'instant d'entrée. */
  historySize: number;
}

export const DEFAULT_DETECTOR_OPTIONS: DetectorOptions = {
  profileSize: 32,
  threshold: 12,
  releaseRatio: 0.6,
  requiredHits: 2,
  warmupFrames: 8,
  // ~0.06 par frame : constante de temps d'environ 16 frames, soit un quart de
  // seconde à 60 fps. Assez lent pour ne pas absorber un sprinteur, assez
  // rapide pour suivre un nuage qui passe ou l'auto-exposition qui se réajuste.
  backgroundAlpha: 0.06,
  historySize: 8,
};

/**
 * Détecteur de franchissement sur une ROI.
 *
 * Il ne voit jamais de pixels : on lui pousse le profil 1D déjà calculé, ce qui
 * permet de faire tourner l'extraction pixel sur le thread caméra et la
 * décision sur le thread JS sans que le délai entre les deux n'entache la
 * mesure — l'instant utilisé est celui de la capture, transmis avec le profil.
 *
 * La ligne franchie est le **bord d'attaque de la ROI**, celui par lequel le
 * sujet entre. L'instant retenu n'est donc pas celui où l'énergie dépasse le
 * seuil — qui dépendrait de la vitesse et du contraste du sujet, et que le
 * réglage de sensibilité déplacerait — mais celui où le sujet touche ce bord,
 * obtenu en extrapolant la montée d'énergie jusqu'au niveau de repos.
 */
export class CrossingDetector {
  private readonly opts: DetectorOptions;
  private readonly background: Float32Array;

  /** Historique circulaire de la montée d'énergie, pour extrapoler l'entrée. */
  private readonly histTimeMs: Float64Array;
  private readonly histEnergy: Float64Array;
  private histCount = 0;
  private histHead = 0;

  private framesSeen = 0;
  private hits = 0;
  private fired = false;

  /** Instant candidat du franchissement, retenu au premier dépassement. */
  private candidateTimeMs = 0;
  private candidateEnergy = 0;

  /** Niveau de repos de l'énergie : bruit de capteur résiduel. */
  private noiseFloor = 0;

  private prevEnergy = 0;
  private prevTimeMs = 0;
  private hasPrev = false;

  private lastEnergy = 0;

  constructor(options: Partial<DetectorOptions> = {}) {
    this.opts = { ...DEFAULT_DETECTOR_OPTIONS, ...options };
    this.background = new Float32Array(this.opts.profileSize);
    this.histTimeMs = new Float64Array(this.opts.historySize);
    this.histEnergy = new Float64Array(this.opts.historySize);
  }

  /** Énergie de la dernière frame, en niveaux 0..255. Pour l'affichage. */
  get energy(): number {
    return this.lastEnergy;
  }

  /** true tant que le fond n'est pas initialisé : aucune détection possible. */
  get isWarmingUp(): boolean {
    return this.framesSeen < this.opts.warmupFrames;
  }

  /**
   * Réarme le détecteur en conservant le fond appris. Sert à activer une ROI
   * en cours de sprint — la ligne d'arrivée n'est prise en compte qu'une fois
   * le départ constaté — sans repayer le warmup au pire moment.
   */
  arm(): void {
    this.hits = 0;
    this.fired = false;
    this.candidateTimeMs = 0;
    this.candidateEnergy = 0;
  }

  reset(): void {
    this.background.fill(0);
    this.histCount = 0;
    this.histHead = 0;
    this.framesSeen = 0;
    this.hits = 0;
    this.fired = false;
    this.candidateTimeMs = 0;
    this.candidateEnergy = 0;
    this.noiseFloor = 0;
    this.prevEnergy = 0;
    this.prevTimeMs = 0;
    this.hasPrev = false;
    this.lastEnergy = 0;
  }

  /**
   * Pousse un profil capturé à `timeMs`. Renvoie l'événement de franchissement
   * la première fois qu'il est confirmé, puis null jusqu'au prochain `reset()`.
   */
  push(profile: Float32Array | number[], timeMs: number): CrossingEvent | null {
    const n = this.opts.profileSize;

    if (this.framesSeen === 0) {
      for (let i = 0; i < n; i++) this.background[i] = profile[i];
      this.framesSeen = 1;
      return null;
    }

    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = profile[i] - this.background[i];
      sum += d < 0 ? -d : d;
    }
    const energy = sum / n;
    this.lastEnergy = energy;

    this.pushHistory(timeMs, energy);

    if (this.framesSeen < this.opts.warmupFrames) {
      // Initialisation rapide du fond : on ne cherche pas encore à détecter.
      this.adaptBackground(profile, 0.5);
      this.noiseFloor = energy;
      this.framesSeen++;
      this.prevEnergy = energy;
      this.prevTimeMs = timeMs;
      this.hasPrev = true;
      return null;
    }
    this.framesSeen++;

    const high = this.opts.threshold;
    const low = high * this.opts.releaseRatio;

    let event: CrossingEvent | null = null;

    if (energy >= high) {
      if (this.hits === 0) {
        // L'instant est retenu ici, au premier dépassement, et non après
        // confirmation : attendre `requiredHits` frames pour horodater
        // ajouterait un retard systématique de plusieurs frames.
        this.candidateTimeMs = this.estimateOnset(timeMs, energy, high);
        this.candidateEnergy = energy;
      }
      this.hits++;

      if (!this.fired && this.hits >= this.opts.requiredHits) {
        this.fired = true;
        event = {
          timeMs: this.candidateTimeMs,
          energy: this.candidateEnergy,
          interpolated: this.hasPrev,
        };
      }
    } else if (energy < low) {
      this.hits = 0;
    }
    // Entre les deux seuils, l'état est conservé : c'est le rôle de
    // l'hystérésis d'éviter qu'une frame limite ne réarme le compteur.

    // Le fond n'est mis à jour que hors événement, sinon le sujet en train de
    // traverser serait progressivement absorbé par le fond qu'il doit dépasser.
    if (this.hits === 0) {
      this.adaptBackground(profile, this.opts.backgroundAlpha);
      this.noiseFloor += 0.05 * (energy - this.noiseFloor);
    }

    this.prevEnergy = energy;
    this.prevTimeMs = timeMs;
    this.hasPrev = true;

    return event;
  }

  private adaptBackground(profile: Float32Array | number[], alpha: number): void {
    const bg = this.background;
    for (let i = 0; i < bg.length; i++) {
      bg[i] += alpha * (profile[i] - bg[i]);
    }
  }

  private pushHistory(timeMs: number, energy: number): void {
    const size = this.opts.historySize;
    this.histTimeMs[this.histHead] = timeMs;
    this.histEnergy[this.histHead] = energy;
    this.histHead = (this.histHead + 1) % size;
    if (this.histCount < size) this.histCount++;
  }

  /** Échantillon i frames avant la plus récente (i = 0 pour la plus récente). */
  private histAt(i: number): { timeMs: number; energy: number } {
    const size = this.opts.historySize;
    const idx = (this.histHead - 1 - i + 2 * size) % size;
    return { timeMs: this.histTimeMs[idx], energy: this.histEnergy[idx] };
  }

  /**
   * Instant où le sujet a touché le bord d'attaque de la ROI.
   *
   * Le recouvrement de la ROI croît linéairement pendant que le sujet y entre,
   * et l'énergie lui est proportionnelle : une droite ajustée sur la montée,
   * prolongée jusqu'au niveau de repos, donne l'instant du premier contact.
   * C'est ce qui rend la mesure indépendante du seuil, donc du réglage de
   * sensibilité, et de la vitesse du sujet.
   */
  private estimateOnset(timeMs: number, energy: number, threshold: number): number {
    const fallback = this.hasPrev
      ? interpolateCrossing(this.prevEnergy, energy, this.prevTimeMs, timeMs, threshold)
      : timeMs;

    // Deux niveaux distincts : `selectLevel` décide quels échantillons font
    // partie de la montée, `this.noiseFloor` est la cible de l'extrapolation.
    // Les confondre ferait dépendre le résultat du seuil, ce qu'on cherche
    // précisément à éviter.
    const selectLevel = this.noiseFloor + Math.max(1, 0.15 * (threshold - this.noiseFloor));
    if (energy <= selectLevel) return fallback;

    // Échantillons contigus de la montée, du plus récent au plus ancien.
    let n = 0;
    let sumT = 0;
    let sumE = 0;
    let earliestRisingTime = timeMs;
    let floorTime = Number.NaN;

    for (let i = 0; i < this.histCount; i++) {
      const s = this.histAt(i);
      if (s.energy <= selectLevel) {
        floorTime = s.timeMs;
        break;
      }
      n++;
      sumT += s.timeMs;
      sumE += s.energy;
      earliestRisingTime = s.timeMs;
    }

    if (n < 2 || !isFinite(floorTime)) return fallback;

    const meanT = sumT / n;
    const meanE = sumE / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const s = this.histAt(i);
      const dt = s.timeMs - meanT;
      num += dt * (s.energy - meanE);
      den += dt * dt;
    }
    if (den <= 0 || num <= 0) return fallback;

    const slope = num / den;
    const onset = meanT + (selectLevel - meanE) / slope;

    // L'extrapolation ne peut pas remonter avant la dernière frame de repos,
    // ni dépasser la première frame de la montée : cela borne l'erreur si la
    // montée n'était pas linéaire.
    if (onset < floorTime) return floorTime;
    if (onset > earliestRisingTime) return earliestRisingTime;
    return onset;
  }
}

/**
 * Situe le franchissement du seuil entre deux frames. L'énergie croît de façon
 * quasi linéaire pendant qu'un sujet entre dans la ROI, donc une interpolation
 * linéaire suffit à ramener l'erreur de ±1 frame à quelques millisecondes.
 */
export function interpolateCrossing(
  prevEnergy: number,
  energy: number,
  prevTimeMs: number,
  timeMs: number,
  threshold: number,
): number {
  const span = energy - prevEnergy;
  if (span <= 0) return timeMs;
  let frac = (threshold - prevEnergy) / span;
  if (frac < 0) frac = 0;
  if (frac > 1) frac = 1;
  return prevTimeMs + frac * (timeMs - prevTimeMs);
}

/**
 * Sensibilité exposée à l'utilisateur (10 = très sensible, 80 = très strict)
 * vers le seuil en niveaux de luminance. Conserve le mapping historique.
 */
export function sensitivityToThreshold(sensitivity: number): number {
  return 5 + ((sensitivity - 10) / 70) * 25;
}
