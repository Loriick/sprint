import type { FrameBuffer, Roi } from '../src/types.ts';

/**
 * Générateur de séquences vidéo synthétiques pour éprouver le détecteur sans
 * appareil : un fond uniforme, du bruit de capteur, une dérive lente de
 * luminosité, et un sujet sombre qui traverse le cadre à vitesse constante.
 */

export interface SceneOptions {
  width: number;
  height: number;
  fps: number;
  /** Luminance du fond, 0..255. */
  background: number;
  /** Amplitude crête du bruit de capteur, en niveaux. */
  noise: number;
  /** Dérive de luminosité en niveaux par seconde (nuage, auto-exposition). */
  driftPerSecond: number;
  /** Largeur du sujet en fraction de la largeur du cadre. */
  subjectWidth: number;
  /** Hauteur du sujet en fraction de la hauteur du cadre. */
  subjectHeight: number;
  /** Position verticale du haut du sujet, en fraction. */
  subjectTop: number;
  /** Contraste du sujet par rapport au fond, en niveaux (négatif = plus sombre). */
  subjectContrast: number;
}

export const DEFAULT_SCENE: SceneOptions = {
  width: 160,
  height: 90,
  fps: 60,
  background: 140,
  noise: 4,
  driftPerSecond: 0,
  subjectWidth: 0.1,
  subjectHeight: 0.7,
  subjectTop: 0.15,
  subjectContrast: -70,
};

/** Générateur pseudo-aléatoire déterministe, pour des tests reproductibles. */
export function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Rend une frame.
 * @param subjectCenterX position du centre du sujet en fraction de largeur,
 *   ou null si le sujet est absent du cadre.
 */
export function renderFrame(
  scene: SceneOptions,
  timeMs: number,
  subjectCenterX: number | null,
  rand: () => number,
): FrameBuffer {
  const { width, height } = scene;
  const data = new Uint8Array(width * height * 3);

  const base = scene.background + (scene.driftPerSecond * timeMs) / 1000;

  let sx0 = -1;
  let sx1 = -1;
  let sy0 = -1;
  let sy1 = -1;
  if (subjectCenterX !== null) {
    const halfW = (scene.subjectWidth * width) / 2;
    sx0 = Math.round(subjectCenterX * width - halfW);
    sx1 = Math.round(subjectCenterX * width + halfW);
    sy0 = Math.round(scene.subjectTop * height);
    sy1 = Math.round((scene.subjectTop + scene.subjectHeight) * height);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = base + (rand() - 0.5) * 2 * scene.noise;
      if (x >= sx0 && x < sx1 && y >= sy0 && y < sy1) {
        v += scene.subjectContrast;
      }
      const c = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
      const idx = (y * width + x) * 3;
      // Gris : les trois canaux portent la même valeur, la luma vaut donc c.
      data[idx] = c;
      data[idx + 1] = c;
      data[idx + 2] = c;
    }
  }

  return { data, width, height, channels: 3 };
}

export interface SequenceFrame {
  frame: FrameBuffer;
  timeMs: number;
  subjectCenterX: number | null;
}

/**
 * Séquence complète : le sujet entre par la gauche à `enterMs` et traverse le
 * cadre en `crossDurationMs`. Avant l'entrée, seul le fond bruité est visible.
 */
export function* generateSequence(
  scene: SceneOptions,
  durationMs: number,
  enterMs: number,
  crossDurationMs: number,
  seed = 12345,
): Generator<SequenceFrame> {
  const rand = makeRandom(seed);
  const frameMs = 1000 / scene.fps;

  for (let timeMs = 0; timeMs <= durationMs; timeMs += frameMs) {
    let subjectCenterX: number | null = null;
    if (timeMs >= enterMs) {
      const progress = (timeMs - enterMs) / crossDurationMs;
      if (progress <= 1.2) {
        // Le sujet part hors cadre à gauche et sort à droite.
        subjectCenterX = -scene.subjectWidth + progress * (1 + 2 * scene.subjectWidth);
      }
    }
    yield { frame: renderFrame(scene, timeMs, subjectCenterX, rand), timeMs, subjectCenterX };
  }
}

/**
 * Instant théorique auquel le bord avant du sujet atteint le bord gauche de la
 * ROI. C'est la vérité terrain à laquelle comparer la détection.
 */
export function trueCrossingMs(
  scene: SceneOptions,
  roi: Roi,
  enterMs: number,
  crossDurationMs: number,
): number {
  const span = 1 + 2 * scene.subjectWidth;
  // centre(t) = -subjectWidth + progress * span ; bord avant = centre + w/2
  const targetCenter = roi.x - scene.subjectWidth / 2;
  const progress = (targetCenter + scene.subjectWidth) / span;
  return enterMs + progress * crossDurationMs;
}
