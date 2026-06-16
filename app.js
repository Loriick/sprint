'use strict';

// ── State ──────────────────────────────────────────────
const state = {
  distance: 10,
  sensitivity: parseInt(localStorage.getItem('sensitivity') || '30'),
  phase: 'idle', // idle | countdown | running | done
  startTime: 0,
  elapsed: 0,
  timerRaf: null,
  prevFrame: null,
  stream: null,
};

// ── DOM refs ───────────────────────────────────────────
const screens = {
  home: document.getElementById('screen-home'),
  camera: document.getElementById('screen-camera'),
  result: document.getElementById('screen-result'),
  settings: document.getElementById('screen-settings'),
};

const video = document.getElementById('video');
const canvasDetect = document.getElementById('canvas-detect');
const ctx = canvasDetect.getContext('2d', { willReadFrequently: true });

const timerValue = document.getElementById('timer-value');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const countdownLabel = document.getElementById('countdown-label');
const detectionZone = document.getElementById('detection-zone');
const zoneLabel = document.getElementById('zone-label');

const resultDistance = document.getElementById('result-distance');
const resultTime = document.getElementById('result-time');
const historyList = document.getElementById('history-list');

const sensitivitySlider = document.getElementById('sensitivity-slider');
const sensitivityVal = document.getElementById('sensitivity-val');

// ── Audio (Web Audio API beeps) ────────────────────────
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function beep(freq, duration, type = 'sine', vol = 0.4) {
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

function beepLow() { beep(440, 0.15); }
function beepGo()  { beep(880, 0.4, 'square', 0.5); }
function beepStop() { beep(1200, 0.6, 'square', 0.6); }

// ── Screen navigation ──────────────────────────────────
function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle('hidden', k !== name);
  });
}

// ── Router (hash-based, minimal) ───────────────────────
// Drives bookmarkable/back-button-able pages (home, settings, history).
// Camera/result stay outside the router: they're transient session states
// driven by user actions, not destinations you'd navigate to directly.
const router = (() => {
  const routes = [];
  let leaveCurrent = null;

  function on(path, enter, leave) {
    const paramNames = [];
    const pattern = path.replace(/:[^/]+/g, (m) => {
      paramNames.push(m.slice(1));
      return '([^/]+)';
    });
    const regex = new RegExp(`^${pattern}$`);
    routes.push({ regex, paramNames, enter, leave: leave || null });
  }

  function resolve() {
    const path = location.hash.slice(1) || '/';
    for (const r of routes) {
      const match = path.match(r.regex);
      if (match) {
        if (leaveCurrent) leaveCurrent();
        const params = {};
        r.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
        leaveCurrent = r.leave;
        r.enter(params);
        return;
      }
    }
    navigate('/');
  }

  function navigate(path) {
    if (location.hash.slice(1) === path) resolve();
    else location.hash = path;
  }

  function start() {
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  return { on, navigate, start };
})();

// ── History ────────────────────────────────────────────
function getHistory() {
  try { return JSON.parse(localStorage.getItem('history') || '[]'); }
  catch { return []; }
}

function saveResult(dist, timeMs) {
  const history = getHistory();
  history.unshift({ dist, timeMs, date: Date.now() });
  if (history.length > 50) history.length = 50;
  localStorage.setItem('history', JSON.stringify(history));
}

function renderHistory() {
  const history = getHistory();
  if (!history.length) {
    historyList.innerHTML = '<p class="empty-history">Aucun résultat encore</p>';
    return;
  }
  historyList.innerHTML = history.slice(0, 8).map(h => {
    const d = new Date(h.date);
    const dateStr = d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    return `
      <div class="history-item">
        <span class="dist-label">${h.dist} yards</span>
        <span class="time-val">${formatTime(h.timeMs)}</span>
        <span class="date-label">${dateStr}</span>
      </div>`;
  }).join('');
}

function formatTime(ms) {
  return (ms / 1000).toFixed(2) + 's';
}

// ── Distance selection ─────────────────────────────────
document.querySelectorAll('.dist-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dist-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.distance = parseInt(btn.dataset.dist);
  });
});

// ── Start flow ─────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', async () => {
  // Unlock audio context on user gesture
  getAudioCtx();
  await startCamera();
});

async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = state.stream;
    await video.play();
    showScreen('camera');
    document.getElementById('cam-distance-label').textContent = state.distance + ' yards';
    startCountdown();
  } catch (err) {
    showCameraError(err);
  }
}

function showCameraError(err) {
  const box = document.getElementById('camera-error');
  box.textContent = 'Impossible d\'accéder à la caméra. ' + (err.message || err);
  box.classList.remove('hidden');
}

// ── Countdown ─────────────────────────────────────────
function startCountdown() {
  state.phase = 'countdown';
  countdownOverlay.classList.remove('hidden');
  timerValue.textContent = '0.00';
  timerValue.classList.remove('running');
  detectionZone.classList.remove('triggered');

  const steps = [
    { text: '5', action: beepLow },
    { text: '4', action: beepLow },
    { text: '3', action: beepLow },
    { text: '2', action: beepLow },
    { text: '1', action: beepLow },
    { text: 'GO !', action: beepGo, isGo: true },
  ];

  let i = 0;

  function tick() {
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
function startRun() {
  state.phase = 'running';
  state.startTime = performance.now();
  state.prevFrame = null;
  timerValue.classList.add('running');
  zoneLabel.textContent = 'LIGNE D\'ARRIVÉE';
  detectionZone.classList.remove('triggered');

  function tick() {
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
function detectLoop() {
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
        const dr = Math.abs(current.data[idx]     - state.prevFrame.data[idx]);
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

function triggerFinish() {
  if (state.phase !== 'running') return;
  state.phase = 'done';
  cancelAnimationFrame(state.timerRaf);

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
function showResult(ms) {
  stopCamera();
  saveResult(state.distance, ms);
  resultDistance.textContent = state.distance + ' YARDS';
  resultTime.innerHTML = (ms / 1000).toFixed(2) + '<span class="result-unit">s</span>';
  showScreen('result');
}

document.getElementById('btn-retry').addEventListener('click', async () => {
  await startCamera();
});

document.getElementById('btn-home').addEventListener('click', () => {
  stopCamera();
  router.navigate('/');
});

// ── Cancel from camera ─────────────────────────────────
document.getElementById('btn-cancel').addEventListener('click', () => {
  stopCamera();
  state.phase = 'idle';
  router.navigate('/');
});

function stopCamera() {
  state.phase = 'idle';
  cancelAnimationFrame(state.timerRaf);
  countdownOverlay.classList.add('hidden');
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  video.srcObject = null;
  state.prevFrame = null;
}

// ── Settings ───────────────────────────────────────────
document.getElementById('btn-settings').addEventListener('click', () => {
  router.navigate('/settings');
});

document.getElementById('btn-settings-back').addEventListener('click', () => {
  router.navigate('/');
});

sensitivitySlider.addEventListener('input', () => {
  state.sensitivity = parseInt(sensitivitySlider.value);
  sensitivityVal.textContent = state.sensitivity;
});

// Live sensitivity preview using front camera
let previewStream = null;
let previewRaf = null;
let previewPrevFrame = null;
const previewCanvas = document.createElement('canvas');
const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });
const previewVideo = document.createElement('video');
previewVideo.muted = true;
previewVideo.playsInline = true;

const motionBars = document.querySelectorAll('.motion-bar-fill');

async function startSensitivityPreview() {
  try {
    previewStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false
    });
    previewVideo.srcObject = previewStream;
    await previewVideo.play();
    previewLoop();
  } catch { /* no preview if no camera */ }
}

function stopSensitivityPreview() {
  cancelAnimationFrame(previewRaf);
  if (previewStream) {
    previewStream.getTracks().forEach(t => t.stop());
    previewStream = null;
  }
  previewPrevFrame = null;
}

function previewLoop() {
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
          const dr = Math.abs(current.data[idx]     - previewPrevFrame.data[idx]);
          const dg = Math.abs(current.data[idx + 1] - previewPrevFrame.data[idx + 1]);
          const db = Math.abs(current.data[idx + 2] - previewPrevFrame.data[idx + 2]);
          totalDiff += (dr + dg + db) / 3;
          samples++;
        }
      }
      const avgDiff = Math.min(totalDiff / samples, 100);
      const pct = (avgDiff / 100) * 100;

      // Update 5 bars with slight stagger for visual effect
      motionBars.forEach((bar, i) => {
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

router.on('/settings', () => {
  sensitivitySlider.value = state.sensitivity;
  sensitivityVal.textContent = state.sensitivity;
  showScreen('settings');
  startSensitivityPreview();
}, () => {
  stopSensitivityPreview();
  localStorage.setItem('sensitivity', state.sensitivity);
});

// ── Init ───────────────────────────────────────────────
(function init() {
  // Set default active distance button
  document.querySelector(`.dist-btn[data-dist="${state.distance}"]`).classList.add('active');
  router.start();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
