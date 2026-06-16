// ── Types ──────────────────────────────────────────────
type Phase = 'idle' | 'countdown' | 'running' | 'done';

interface AppState {
  distance: number;
  sensitivity: number;
  phase: Phase;
  startTime: number;
  elapsed: number;
  timerRaf: number | null;
  prevFrame: ImageData | null;
  stream: MediaStream | null;
}

interface HistoryEntry {
  id: string;
  dist: number;
  timeMs: number;
  date: number;
}

type ScreenName = 'home' | 'camera' | 'result' | 'settings' | 'history';
type RouteParams = Record<string, string>;
type RouteHandler = (params: RouteParams) => void;

// ── State ──────────────────────────────────────────────
const state: AppState = {
  distance: 10,
  sensitivity: parseInt(localStorage.getItem('sensitivity') || '30'),
  phase: 'idle',
  startTime: 0,
  elapsed: 0,
  timerRaf: null,
  prevFrame: null,
  stream: null,
};

// ── DOM refs ───────────────────────────────────────────
const screens: Record<ScreenName, HTMLElement> = {
  home: document.getElementById('screen-home') as HTMLElement,
  camera: document.getElementById('screen-camera') as HTMLElement,
  result: document.getElementById('screen-result') as HTMLElement,
  settings: document.getElementById('screen-settings') as HTMLElement,
  history: document.getElementById('screen-history') as HTMLElement,
};

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
const historyList = document.getElementById('history-list') as HTMLElement;
const historyPageList = document.getElementById('history-page-list') as HTMLElement;
const historyTabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');

const sensitivitySlider = document.getElementById('sensitivity-slider') as HTMLInputElement;
const sensitivityVal = document.getElementById('sensitivity-val') as HTMLElement;

// ── Audio (Web Audio API beeps) ────────────────────────
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.4): void {
  const ac = getAudioCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
}

function beepLow(): void { beep(440, 0.15); }
function beepGo(): void { beep(880, 0.4, 'square', 0.5); }
function beepStop(): void { beep(1200, 0.6, 'square', 0.6); }

// ── Screen navigation ──────────────────────────────────
function showScreen(name: ScreenName): void {
  (Object.entries(screens) as [ScreenName, HTMLElement][]).forEach(([k, el]) => {
    el.classList.toggle('hidden', k !== name);
  });
}

// ── Router (hash-based, minimal) ───────────────────────
// Drives bookmarkable/back-button-able pages (home, settings, history).
// Camera/result stay outside the router: they're transient session states
// driven by user actions, not destinations you'd navigate to directly.
const router = (() => {
  interface Route {
    regex: RegExp;
    paramNames: string[];
    enter: RouteHandler;
    leave: (() => void) | null;
  }

  const routes: Route[] = [];
  let leaveCurrent: (() => void) | null = null;

  function on(path: string, enter: RouteHandler, leave?: () => void): void {
    const paramNames: string[] = [];
    const pattern = path.replace(/:[^/]+/g, (m) => {
      paramNames.push(m.slice(1));
      return '([^/]+)';
    });
    const regex = new RegExp(`^${pattern}$`);
    routes.push({ regex, paramNames, enter, leave: leave || null });
  }

  function resolve(): void {
    const path = location.hash.slice(1) || '/';
    for (const r of routes) {
      const match = path.match(r.regex);
      if (match) {
        if (leaveCurrent) leaveCurrent();
        const params: RouteParams = {};
        r.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
        leaveCurrent = r.leave;
        r.enter(params);
        return;
      }
    }
    navigate('/');
  }

  function navigate(path: string): void {
    if (location.hash.slice(1) === path) resolve();
    else location.hash = path;
  }

  function start(): void {
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  return { on, navigate, start };
})();

// ── History ────────────────────────────────────────────
function getHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem('history') || '[]'); }
  catch { return []; }
}

function saveResult(dist: number, timeMs: number): void {
  const history = getHistory();
  const id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
  history.unshift({ id, dist, timeMs, date: Date.now() });
  if (history.length > 50) history.length = 50;
  localStorage.setItem('history', JSON.stringify(history));
}

function deleteResult(id: string): void {
  const history = getHistory().filter((h) => h.id !== id);
  localStorage.setItem('history', JSON.stringify(history));
}

function renderHistory(): void {
  const history = getHistory();
  if (!history.length) {
    historyList.innerHTML = '<p class="empty-history">Aucun résultat encore</p>';
    return;
  }
  historyList.innerHTML = history.slice(0, 8).map((h) => {
    const d = new Date(h.date);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="history-item">
        <span class="dist-label">${h.dist} yards</span>
        <span class="time-val">${formatTime(h.timeMs)}</span>
        <span class="date-label">${dateStr}</span>
      </div>`;
  }).join('');
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2) + 's';
}

// ── History page (full, filterable by distance, deletable) ──
function renderHistoryPage(distFilter: string): void {
  historyTabs.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.dist === distFilter);
  });

  const history = getHistory().filter((h) => distFilter === 'all' || String(h.dist) === distFilter);

  if (!history.length) {
    historyPageList.innerHTML = '<p class="empty-history">Aucun résultat</p>';
    return;
  }

  historyPageList.innerHTML = history.map((h) => {
    const d = new Date(h.date);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="history-item">
        <div class="item-info">
          <span class="dist-label">${h.dist} yards</span>
          <span class="date-label">${dateStr}</span>
        </div>
        <span class="time-val">${formatTime(h.timeMs)}</span>
        <button class="btn-delete" data-id="${h.id}" aria-label="Supprimer">✕</button>
      </div>`;
  }).join('');
}

historyPageList.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest<HTMLButtonElement>('.btn-delete');
  if (!btn || !btn.dataset.id) return;
  deleteResult(btn.dataset.id);
  const activeTab = document.querySelector<HTMLButtonElement>('.tab-btn.active');
  renderHistoryPage(activeTab ? activeTab.dataset.dist || 'all' : 'all');
});

historyTabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    const dist = btn.dataset.dist as string;
    router.navigate(dist === 'all' ? '/history' : `/history/${dist}`);
  });
});

document.getElementById('btn-view-history')!.addEventListener('click', () => {
  router.navigate('/history');
});

document.getElementById('btn-history-back')!.addEventListener('click', () => {
  router.navigate('/');
});

// ── Distance selection ─────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.dist-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dist-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.distance = parseInt(btn.dataset.dist as string);
  });
});

// ── Start flow ─────────────────────────────────────────
document.getElementById('btn-start')!.addEventListener('click', async () => {
  // Unlock audio context on user gesture
  getAudioCtx();
  await startCamera();
});

async function startCamera(): Promise<void> {
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
  box.textContent = 'Impossible d\'accéder à la caméra. ' + (err.message || err);
  box.classList.remove('hidden');
}

// ── Countdown ─────────────────────────────────────────
function startCountdown(): void {
  state.phase = 'countdown';
  countdownOverlay.classList.remove('hidden');
  timerValue.textContent = '0.00';
  timerValue.classList.remove('running');
  detectionZone.classList.remove('triggered');

  const steps: { text: string; action: () => void; isGo?: boolean }[] = [
    { text: '5', action: beepLow },
    { text: '4', action: beepLow },
    { text: '3', action: beepLow },
    { text: '2', action: beepLow },
    { text: '1', action: beepLow },
    { text: 'GO !', action: beepGo, isGo: true },
  ];

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
    countdownLabel.textContent = s.isGo ? 'EN POSITION · PARTEZ !' : 'PRÉPAREZ-VOUS';
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
  zoneLabel.textContent = 'LIGNE D\'ARRIVÉE';
  detectionZone.classList.remove('triggered');

  function tick(): void {
    if (state.phase !== 'running') return;
    state.elapsed = performance.now() - state.startTime;
    timerValue.textContent = (state.elapsed / 1000).toFixed(2);
    state.timerRaf = requestAnimationFrame(tick);
  }
  tick();

  // Start motion detection loop
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

  // Show result after short delay
  setTimeout(() => showResult(finalMs), 1200);
}

// ── Result screen ──────────────────────────────────────
function showResult(ms: number): void {
  stopCamera();
  saveResult(state.distance, ms);
  resultDistance.textContent = state.distance + ' YARDS';
  resultTime.innerHTML = (ms / 1000).toFixed(2) + '<span class="result-unit">s</span>';
  showScreen('result');
}

document.getElementById('btn-retry')!.addEventListener('click', async () => {
  await startCamera();
});

document.getElementById('btn-home')!.addEventListener('click', () => {
  stopCamera();
  router.navigate('/');
});

// ── Cancel from camera ─────────────────────────────────
document.getElementById('btn-cancel')!.addEventListener('click', () => {
  stopCamera();
  state.phase = 'idle';
  router.navigate('/');
});

function stopCamera(): void {
  state.phase = 'idle';
  if (state.timerRaf !== null) cancelAnimationFrame(state.timerRaf);
  countdownOverlay.classList.add('hidden');
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  video.srcObject = null;
  state.prevFrame = null;
}

// ── Settings ───────────────────────────────────────────
document.getElementById('btn-settings')!.addEventListener('click', () => {
  router.navigate('/settings');
});

document.getElementById('btn-settings-back')!.addEventListener('click', () => {
  router.navigate('/');
});

sensitivitySlider.addEventListener('input', () => {
  state.sensitivity = parseInt(sensitivitySlider.value);
  sensitivityVal.textContent = String(state.sensitivity);
});

// Live sensitivity preview using front camera
let previewStream: MediaStream | null = null;
let previewRaf: number | null = null;
let previewPrevFrame: ImageData | null = null;
const previewCanvas = document.createElement('canvas');
const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
const previewVideo = document.createElement('video');
previewVideo.muted = true;
previewVideo.playsInline = true;

const motionBars = document.querySelectorAll<HTMLElement>('.motion-bar-fill');

async function startSensitivityPreview(): Promise<void> {
  try {
    previewStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false,
    });
    previewVideo.srcObject = previewStream;
    await previewVideo.play();
    previewLoop();
  } catch { /* no preview if no camera */ }
}

function stopSensitivityPreview(): void {
  if (previewRaf !== null) cancelAnimationFrame(previewRaf);
  if (previewStream) {
    previewStream.getTracks().forEach((t) => t.stop());
    previewStream = null;
  }
  previewPrevFrame = null;
}

function previewLoop(): void {
  if (!previewStream) return;
  const vw = previewVideo.videoWidth;
  const vh = previewVideo.videoHeight;
  if (vw && vh) {
    previewCanvas.width = vw;
    previewCanvas.height = vh;
    previewCtx.drawImage(previewVideo, 0, 0, vw, vh);
    const zoneWidth = Math.floor(vw * 0.08);
    const zoneX = Math.floor(vw / 2 - zoneWidth / 2);
    const sampleStep = Math.max(1, Math.floor(vh / 40));
    const current = previewCtx.getImageData(zoneX, 0, zoneWidth, vh);

    if (previewPrevFrame) {
      let totalDiff = 0;
      let samples = 0;
      for (let y = 0; y < vh; y += sampleStep) {
        for (let x = 0; x < zoneWidth; x += 2) {
          const idx = (y * zoneWidth + x) * 4;
          const dr = Math.abs(current.data[idx] - previewPrevFrame.data[idx]);
          const dg = Math.abs(current.data[idx + 1] - previewPrevFrame.data[idx + 1]);
          const db = Math.abs(current.data[idx + 2] - previewPrevFrame.data[idx + 2]);
          totalDiff += (dr + dg + db) / 3;
          samples++;
        }
      }
      const avgDiff = Math.min(totalDiff / samples, 100);
      const pct = (avgDiff / 100) * 100;

      // Update bars with slight stagger for visual effect
      motionBars.forEach((bar) => {
        const variation = (Math.random() - 0.5) * 15;
        bar.style.height = Math.max(4, Math.min(100, pct + variation)) + '%';
        bar.style.background = avgDiff > state.sensitivity ? 'var(--green)' : 'var(--muted)';
      });
    }
    previewPrevFrame = current;
  }
  previewRaf = requestAnimationFrame(previewLoop);
}

// ── Routes ──────────────────────────────────────────────
router.on('/', () => {
  renderHistory();
  showScreen('home');
});

router.on('/history', () => {
  renderHistoryPage('all');
  showScreen('history');
});

router.on('/history/:dist', (params) => {
  renderHistoryPage(params.dist);
  showScreen('history');
});

router.on('/settings', () => {
  sensitivitySlider.value = String(state.sensitivity);
  sensitivityVal.textContent = String(state.sensitivity);
  showScreen('settings');
  startSensitivityPreview();
}, () => {
  stopSensitivityPreview();
  localStorage.setItem('sensitivity', String(state.sensitivity));
});

// ── Init ───────────────────────────────────────────────
(function init(): void {
  // Set default active distance button
  document.querySelector(`.dist-btn[data-dist="${state.distance}"]`)!.classList.add('active');
  router.start();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
