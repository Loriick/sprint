import assert from 'node:assert/strict';
import test from 'node:test';

import { CrossingDetector, interpolateCrossing, sensitivityToThreshold } from '../src/detector.ts';
import { computeProfile } from '../src/profile.ts';
import { DEFAULT_FINISH_ROI, clampRoi } from '../src/roi.ts';
import { DEFAULT_SCENE, generateSequence, trueCrossingMs } from './synthetic.ts';
import type { CrossingEvent, Roi } from '../src/types.ts';

const PROFILE_SIZE = 32;
const ROW_SAMPLES = 16;

interface RunOptions {
  scene?: Partial<typeof DEFAULT_SCENE>;
  roi?: Roi;
  threshold?: number;
  durationMs?: number;
  enterMs?: number;
  crossDurationMs?: number;
  seed?: number;
}

/** Fait tourner une séquence synthétique dans le détecteur. */
function runSequence(opts: RunOptions = {}): {
  event: CrossingEvent | null;
  truthMs: number;
  peakEnergy: number;
} {
  const scene = { ...DEFAULT_SCENE, ...opts.scene };
  const roi = clampRoi(opts.roi ?? DEFAULT_FINISH_ROI);
  const durationMs = opts.durationMs ?? 4000;
  const enterMs = opts.enterMs ?? 1500;
  const crossDurationMs = opts.crossDurationMs ?? 1200;

  const detector = new CrossingDetector({
    profileSize: PROFILE_SIZE,
    threshold: opts.threshold ?? 12,
  });

  const profile = new Float32Array(PROFILE_SIZE);
  let event: CrossingEvent | null = null;
  let peakEnergy = 0;

  for (const { frame, timeMs } of generateSequence(
    scene,
    durationMs,
    enterMs,
    crossDurationMs,
    opts.seed,
  )) {
    computeProfile(frame, roi, profile, ROW_SAMPLES);
    const e = detector.push(profile, timeMs);
    if (detector.energy > peakEnergy) peakEnergy = detector.energy;
    if (e && !event) event = e;
  }

  return { event, truthMs: trueCrossingMs(scene, roi, enterMs, crossDurationMs), peakEnergy };
}

test('détecte un sujet qui franchit la ROI', () => {
  const { event } = runSequence();
  assert.ok(event, 'aucun franchissement détecté');
});

test('horodate le franchissement à moins d’une frame de la vérité terrain', () => {
  const { event, truthMs } = runSequence({ scene: { fps: 60 } });
  assert.ok(event);
  const errorMs = Math.abs(event.timeMs - truthMs);
  const frameMs = 1000 / 60;
  assert.ok(
    errorMs < frameMs,
    `erreur de ${errorMs.toFixed(1)} ms, attendue sous ${frameMs.toFixed(1)} ms`,
  );
});

test('ne déclenche pas sur le bruit de capteur seul', () => {
  // Sujet hors du cadre pendant toute la séquence : il ne reste que le bruit.
  const { event } = runSequence({ enterMs: 99_000, durationMs: 3000 });
  assert.equal(event, null);
});

test('ne déclenche pas sur une dérive lente de luminosité', () => {
  // 40 niveaux par seconde pendant 4 s : bien plus qu'un nuage ou qu'un
  // réajustement d'auto-exposition, et bien au-delà du seuil s'il n'y avait
  // pas de fond adaptatif.
  const { event, peakEnergy } = runSequence({
    scene: { driftPerSecond: 40 },
    enterMs: 99_000,
    durationMs: 4000,
  });
  assert.equal(event, null, `déclenché à tort, énergie crête ${peakEnergy.toFixed(1)}`);
});

test('détecte malgré une dérive de luminosité simultanée', () => {
  const { event, truthMs } = runSequence({ scene: { driftPerSecond: 40 } });
  assert.ok(event, 'la dérive a masqué le sujet');
  assert.ok(Math.abs(event.timeMs - truthMs) < 2 * (1000 / 60));
});

test('détecte un sujet peu contrasté', () => {
  const { event } = runSequence({ scene: { subjectContrast: -30 }, threshold: 8 });
  assert.ok(event);
});

test('ne renvoie qu’un seul événement par armement', () => {
  const scene = DEFAULT_SCENE;
  const roi = DEFAULT_FINISH_ROI;
  const detector = new CrossingDetector({ profileSize: PROFILE_SIZE, threshold: 12 });
  const profile = new Float32Array(PROFILE_SIZE);
  let count = 0;

  for (const { frame, timeMs } of generateSequence(scene, 4000, 1500, 1200)) {
    computeProfile(frame, roi, profile, ROW_SAMPLES);
    if (detector.push(profile, timeMs)) count++;
  }

  assert.equal(count, 1);
});

test('le réarmement conserve le fond appris', () => {
  const scene = DEFAULT_SCENE;
  const roi = DEFAULT_FINISH_ROI;
  const detector = new CrossingDetector({ profileSize: PROFILE_SIZE, threshold: 12 });
  const profile = new Float32Array(PROFILE_SIZE);

  const frames = [...generateSequence(scene, 4000, 1500, 1200)];

  // Premier passage complet, puis réarmement.
  for (const { frame, timeMs } of frames) {
    computeProfile(frame, roi, profile, ROW_SAMPLES);
    detector.push(profile, timeMs);
  }
  detector.arm();

  assert.equal(detector.isWarmingUp, false, 'le warmup ne doit pas recommencer');

  // Un second passage doit être détecté immédiatement, sans repayer le warmup.
  let event: CrossingEvent | null = null;
  for (const { frame, timeMs } of generateSequence(scene, 4000, 500, 1200, 999)) {
    computeProfile(frame, roi, profile, ROW_SAMPLES);
    const e = detector.push(profile, timeMs + 5000);
    if (e && !event) event = e;
  }
  assert.ok(event);
});

test('interpolateCrossing situe le seuil entre deux frames', () => {
  // Le seuil 10 est franchi à mi-chemin entre 5 et 15.
  assert.equal(interpolateCrossing(5, 15, 100, 200, 10), 150);
  // Énergie qui n'augmente pas : on retombe sur la frame courante.
  assert.equal(interpolateCrossing(15, 15, 100, 200, 10), 200);
  assert.equal(interpolateCrossing(20, 10, 100, 200, 15), 200);
});

test('sensitivityToThreshold couvre la plage historique', () => {
  assert.equal(sensitivityToThreshold(10), 5);
  assert.equal(sensitivityToThreshold(80), 30);
});
