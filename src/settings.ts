import { router } from './router';
import { showScreen } from './screens';
import { state } from './state';
import type { Units } from './types';

const sensitivitySlider = document.getElementById('sensitivity-slider') as HTMLInputElement;
const sensitivityVal = document.getElementById('sensitivity-val') as HTMLElement;
const motionBars = document.querySelectorAll<HTMLElement>('.motion-bar-fill');
const unitsButtons = document.querySelectorAll<HTMLButtonElement>('.units-btn');
const toggleSound = document.getElementById('toggle-sound') as HTMLButtonElement;
const toggleHaptics = document.getElementById('toggle-haptics') as HTMLButtonElement;

function syncToggleStates(): void {
  unitsButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.units === state.units);
  });
  toggleSound.classList.toggle('on', state.sound);
  toggleHaptics.classList.toggle('on', state.haptics);
}

// Live sensitivity preview using front camera
let previewStream: MediaStream | null = null;
let previewRaf: number | null = null;
let previewPrevFrame: ImageData | null = null;
const previewCanvas = document.createElement('canvas');
const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
const previewVideo = document.createElement('video');
previewVideo.muted = true;
previewVideo.playsInline = true;

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
        bar.style.background = avgDiff > state.sensitivity ? 'var(--accent)' : 'var(--text-muted)';
      });
    }
    previewPrevFrame = current;
  }
  previewRaf = requestAnimationFrame(previewLoop);
}

export function init(): void {
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

  unitsButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.units = btn.dataset.units as Units;
      localStorage.setItem('units', state.units);
      syncToggleStates();
    });
  });

  toggleSound.addEventListener('click', () => {
    state.sound = !state.sound;
    localStorage.setItem('sound', String(state.sound));
    syncToggleStates();
  });

  toggleHaptics.addEventListener('click', () => {
    state.haptics = !state.haptics;
    localStorage.setItem('haptics', String(state.haptics));
    syncToggleStates();
  });

  router.on('/settings', () => {
    sensitivitySlider.value = String(state.sensitivity);
    sensitivityVal.textContent = String(state.sensitivity);
    syncToggleStates();
    showScreen('settings');
    startSensitivityPreview();
  }, () => {
    stopSensitivityPreview();
    localStorage.setItem('sensitivity', String(state.sensitivity));
  });
}
