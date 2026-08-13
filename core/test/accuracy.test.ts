import assert from 'node:assert/strict';
import test from 'node:test';

import { CrossingDetector, sensitivityToThreshold } from '../src/detector.ts';
import { computeProfile } from '../src/profile.ts';
import { DEFAULT_FINISH_ROI } from '../src/roi.ts';
import { DEFAULT_SCENE, generateSequence, trueCrossingMs } from './synthetic.ts';
import type { SceneOptions } from './synthetic.ts';

const PROFILE_SIZE = 32;
const ROW_SAMPLES = 16;
const ROI = DEFAULT_FINISH_ROI;

/** Erreur d'horodatage, en ms, pour un jeu de conditions donné. */
function measureError(
  scene: SceneOptions,
  threshold: number,
  crossDurationMs: number,
  seed: number,
): number | null {
  const detector = new CrossingDetector({ profileSize: PROFILE_SIZE, threshold });
  const profile = new Float32Array(PROFILE_SIZE);
  const enterMs = 1500;

  for (const { frame, timeMs } of generateSequence(scene, 5000, enterMs, crossDurationMs, seed)) {
    computeProfile(frame, ROI, profile, ROW_SAMPLES);
    const event = detector.push(profile, timeMs);
    if (event) return event.timeMs - trueCrossingMs(scene, ROI, enterMs, crossDurationMs);
  }
  return null;
}

test('le temps mesuré ne dépend pas du réglage de sensibilité', () => {
  // C'est la propriété qui justifie l'extrapolation d'entrée : sans elle, un
  // seuil plus haut déplace mécaniquement le temps mesuré, et deux athlètes
  // réglés différemment ne sont plus comparables.
  const errors = [10, 25, 40, 60, 80].map((sensitivity) => {
    const err = measureError(DEFAULT_SCENE, sensitivityToThreshold(sensitivity), 1200, 4242);
    assert.ok(err !== null, `aucune détection à la sensibilité ${sensitivity}`);
    return err;
  });

  const spread = Math.max(...errors) - Math.min(...errors);
  assert.ok(
    spread < 10,
    `dispersion de ${spread.toFixed(1)} ms entre les sensibilités : ${errors
      .map((e) => e.toFixed(1))
      .join(', ')}`,
  );
});

test('le temps mesuré ne dépend pas de la vitesse du sujet', () => {
  const errors = [700, 1000, 1400, 2000].map((crossDurationMs) => {
    const err = measureError(DEFAULT_SCENE, 12, crossDurationMs, 777);
    assert.ok(err !== null, `aucune détection à ${crossDurationMs} ms de traversée`);
    return err;
  });

  const spread = Math.max(...errors) - Math.min(...errors);
  assert.ok(
    spread < 12,
    `dispersion de ${spread.toFixed(1)} ms selon la vitesse : ${errors
      .map((e) => e.toFixed(1))
      .join(', ')}`,
  );
});

test('l’erreur reste sous la demi-frame à 60 fps', () => {
  const errors: number[] = [];
  for (let seed = 1; seed <= 12; seed++) {
    const err = measureError({ ...DEFAULT_SCENE, fps: 60 }, 12, 1200, seed * 101);
    assert.ok(err !== null, `aucune détection au tirage ${seed}`);
    errors.push(Math.abs(err));
  }
  const worst = Math.max(...errors);
  assert.ok(worst < 1000 / 60 / 2, `pire erreur ${worst.toFixed(1)} ms sur 12 tirages`);
});

test('l’erreur reste sous une frame à 30 fps', () => {
  // Sans interpolation ni extrapolation, l'erreur atteindrait mécaniquement une
  // frame entière, soit 33 ms — près de 2 % sur un 10 yards.
  const errors: number[] = [];
  for (let seed = 1; seed <= 12; seed++) {
    const err = measureError({ ...DEFAULT_SCENE, fps: 30 }, 12, 1200, seed * 131);
    assert.ok(err !== null, `aucune détection au tirage ${seed}`);
    errors.push(Math.abs(err));
  }
  const worst = Math.max(...errors);
  assert.ok(worst < 1000 / 30, `pire erreur ${worst.toFixed(1)} ms sur 12 tirages`);
});

test('un doublement de résolution ne change pas la mesure', () => {
  // Le profil est échantillonné à taille fixe : la PWA en pleine résolution et
  // le natif en aperçu réduit doivent mesurer la même chose.
  const small = measureError({ ...DEFAULT_SCENE, width: 160, height: 90 }, 12, 1200, 31337);
  const large = measureError({ ...DEFAULT_SCENE, width: 320, height: 180 }, 12, 1200, 31337);
  assert.ok(small !== null && large !== null);
  assert.ok(
    Math.abs(small - large) < 8,
    `écart de ${Math.abs(small - large).toFixed(1)} ms entre 160×90 et 320×180`,
  );
});
