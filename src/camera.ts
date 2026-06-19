import { beepGo, beepLow, beepStop, vibrate } from './audio';
import { getBest, saveResult, speedForUnits, speedKmh, speedMph, speedUnitLabel } from './history';
import { t } from './i18n';
import { router } from './router';
import { showScreen } from './screens';
import { state } from './state';

const video = document.getElementById('video') as HTMLVideoElement;
const canvasDetect = document.getElementById('canvas-detect') as HTMLCanvasElement;
const ctx = canvasDetect.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

const timerValue = document.getElementById('timer-value') as HTMLElement;
const countdownOverlay = document.getElementById('countdown-overlay') as HTMLElement;
const countdownNumber = document.getElementById('countdown-number') as HTMLElement;
const countdownLabel = document.getElementById('countdown-label') as HTMLElement;
const detectionZone = document.getElementById('detection-zone') as HTMLElement;
const zoneLabel = document.getElementById('zone-label') as HTMLElement;

const resultDistance = document.getElementById('result-distance') as HTMLElement;
const resultTime = document.getElementById('result-time') as HTMLElement;
const resultPbPill = document.getElementById('result-pb-pill') as HTMLElement;
const resultSpeedPrimary = document.getElementById('result-speed-primary') as HTMLElement;
const resultSpeedSecondary = document.getElementById('result-speed-secondary') as HTMLElement;
const resultVsBest = document.getElementById('result-vs-best') as HTMLElement;
const resultBestTime = document.getElementById('result-best-time') as HTMLElement;

export async function startCamera(): Promise<void> {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = state.stream;
    await video.play();
    showScreen('camera');
    (document.getElementById('cam-distance-label') as HTMLElement).textContent = state.distance + ' yards';
    startCountdown();
  } catch (err) {
    showCameraError(err as Error);
  }
}

function showCameraError(err: Error): void {
  const box = document.getElementById('camera-error') as HTMLElement;
  box.textContent = t('cam_error') + ' ' + (err.message || err);
  box.classList.remove('hidden');
}

// ── Countdown ─────────────────────────────────────────
function startCountdown(): void {
  state.phase = 'countdown';
  countdownOverlay.classList.remove('hidden');
  timerValue.textContent = '0.00';
  timerValue.classList.remove('running');
  detectionZone.classList.remove('triggered');

  const steps: { text: string; action: () => void; isGo?: boolean }[] = [];
  for (let i = state.countdownDuration; i >= 1; i--) {
    steps.push({ text: String(i), action: beepLow });
  }
  steps.push({ text: 'GO !', action: () => { beepGo(); vibrate(80); }, isGo: true });

  let i = 0;

  function tick(): void {
    if (i >= steps.length) {
      countdownOverlay.classList.add('hidden');
      startRun();
      return;
    }
    const s = steps[i++];
    countdownNumber.textContent = s.text;
    countdownNumber.classList.toggle('go', !!s.isGo);
    countdownLabel.textContent = s.isGo ? t('cam_go_label') : t('cam_get_ready');
    s.action();
    setTimeout(tick, s.isGo ? 800 : 1000);
  }

  tick();
}

// ── Run & timer ────────────────────────────────────────
function startRun(): void {
  state.phase = 'running';
  state.startTime = performance.now();
  state.prevFrame = null;
  timerValue.classList.add('running');
  zoneLabel.textContent = t('cam_finish_line');
  detectionZone.classList.remove('triggered');

  function tick(): void {
    if (state.phase !== 'running') return;
    state.elapsed = performance.now() - state.startTime;
    timerValue.textContent = (state.elapsed / 1000).toFixed(2);
    state.timerRaf = requestAnimationFrame(tick);
  }
  tick();

  requestAnimationFrame(detectLoop);
}

// ── Motion detection ───────────────────────────────────
function detectLoop(): void {
  if (state.phase !== 'running') return;

  if (video.readyState < 2) {
    requestAnimationFrame(detectLoop);
    return;
  }

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    requestAnimationFrame(detectLoop);
    return;
  }

  canvasDetect.width = vw;
  canvasDetect.height = vh;

  // Draw current frame
  ctx.drawImage(video, 0, 0, vw, vh);

  // Sample a vertical strip in the center (detection zone)
  const zoneWidth = Math.floor(vw * 0.08); // 8% of width
  const zoneX = Math.floor(vw / 2 - zoneWidth / 2);
  const sampleStep = Math.max(1, Math.floor(vh / 40)); // ~40 sample rows

  const current = ctx.getImageData(zoneX, 0, zoneWidth, vh);

  if (state.prevFrame) {
    let totalDiff = 0;
    let samples = 0;

    for (let y = 0; y < vh; y += sampleStep) {
      for (let x = 0; x < zoneWidth; x += 2) {
        const idx = (y * zoneWidth + x) * 4;
        const dr = Math.abs(current.data[idx] - state.prevFrame.data[idx]);
        const dg = Math.abs(current.data[idx + 1] - state.prevFrame.data[idx + 1]);
        const db = Math.abs(current.data[idx + 2] - state.prevFrame.data[idx + 2]);
        totalDiff += (dr + dg + db) / 3;
        samples++;
      }
    }

    const avgDiff = totalDiff / samples;

    if (avgDiff > state.sensitivity) {
      triggerFinish();
      return;
    }
  }

  state.prevFrame = current;
  requestAnimationFrame(detectLoop);
}

function triggerFinish(): void {
  if (state.phase !== 'running') return;
  state.phase = 'done';
  if (state.timerRaf !== null) cancelAnimationFrame(state.timerRaf);

  const finalMs = performance.now() - state.startTime;
  state.elapsed = finalMs;
  timerValue.textContent = (finalMs / 1000).toFixed(2);
  timerValue.classList.remove('running');

  detectionZone.classList.add('triggered');
  beepStop();
  vibrate([60, 40, 60]);

  setTimeout(() => showResult(finalMs), 1200);
}

// ── Result screen ──────────────────────────────────────
function showResult(ms: number): void {
  stopCamera();
  const prevBest = getBest(state.distance);
  saveResult(state.distance, ms);

  resultDistance.textContent = state.distance + ' YARDS';
  resultTime.innerHTML = (ms / 1000).toFixed(2) + '<span class="result-unit">s</span>';

  const kmh = speedKmh(state.distance, ms);
  const mph = speedMph(state.distance, ms);
  const resultSpeedUnit = document.querySelector('#screen-result .result-stat-unit') as HTMLElement;
  resultSpeedPrimary.textContent = speedForUnits(state.distance, ms).toFixed(1);
  resultSpeedUnit.textContent = speedUnitLabel();
  resultSpeedSecondary.textContent = state.units === 'imperial'
    ? kmh.toFixed(1) + ' km/h'
    : mph.toFixed(1) + ' mph';

  const isPB = prevBest == null || ms < prevBest;
  resultPbPill.classList.toggle('hidden', !isPB);

  if (isPB) {
    resultVsBest.textContent = t('result_record_word');
    resultBestTime.textContent = prevBest == null ? '' : `${t('result_previous')} ${(prevBest / 1000).toFixed(2)}s`;
    resultVsBest.classList.remove('slower');
  } else {
    const deltaS = Math.abs(ms - (prevBest as number)) / 1000;
    const faster = ms < (prevBest as number);
    resultVsBest.textContent = (faster ? '↓ ' : '↑ ') + deltaS.toFixed(2) + 's';
    resultVsBest.classList.toggle('slower', !faster);
    resultBestTime.textContent = `${t('result_record')} ${((prevBest as number) / 1000).toFixed(2)}s`;
  }

  showScreen('result');
}

export function stopCamera(): void {
  state.phase = 'idle';
  if (state.timerRaf !== null) cancelAnimationFrame(state.timerRaf);
  countdownOverlay.classList.add('hidden');
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
  video.srcObject = null;
  state.prevFrame = null;
}

export function init(): void {
  document.getElementById('btn-cancel')!.addEventListener('click', () => {
    stopCamera();
    state.phase = 'idle';
    router.navigate('/');
  });
}
