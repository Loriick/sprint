import { beepLow } from './audio';
import { startCamera } from './camera';
import { formatRest } from './countdown-picker';
import { t } from './i18n';
import { state } from './state';

// Chains sprints automatically: after each result, a rest countdown runs on
// the result screen, then the next sprint starts by itself (camera countdown
// + GO beep). camera.ts announces each finished sprint via 'sprint:result'.

const banner = document.getElementById('series-banner') as HTMLElement;
const progressEl = document.getElementById('series-progress') as HTMLElement;
const nextEl = document.getElementById('series-next') as HTMLElement;
const btnStop = document.getElementById('btn-series-stop') as HTMLButtonElement;

let restTimer: ReturnType<typeof setInterval> | null = null;

function clearRestTimer(): void {
  if (restTimer !== null) { clearInterval(restTimer); restTimer = null; }
}

function endSeries(): void {
  clearRestTimer();
  state.seriesIndex = 0;
  banner.classList.add('hidden');
}

function onResultShown(): void {
  if (state.seriesTotal <= 1 || state.seriesIndex === 0) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  progressEl.textContent = `Sprint ${state.seriesIndex}/${state.seriesTotal}`;

  if (state.seriesIndex >= state.seriesTotal) {
    nextEl.textContent = t('series_done');
    btnStop.classList.add('hidden');
    state.seriesIndex = 0;
    return;
  }

  btnStop.classList.remove('hidden');
  let remaining = state.restDuration;
  nextEl.textContent = `${t('series_next_in')} ${formatRest(remaining)}`;

  clearRestTimer();
  restTimer = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      nextEl.textContent = `${t('series_next_in')} ${formatRest(remaining)}`;
      if (remaining <= 3) beepLow();
      return;
    }
    clearRestTimer();
    state.seriesIndex++;
    banner.classList.add('hidden');
    startCamera();
  }, 1000);
}

export function init(): void {
  document.addEventListener('sprint:result', onResultShown);

  btnStop.addEventListener('click', endSeries);

  // Leaving the result screen by hand ends (home) or pauses (retry) the chain
  document.getElementById('btn-home')!.addEventListener('click', endSeries);
  document.getElementById('btn-cancel')!.addEventListener('click', endSeries);
  document.getElementById('btn-retry')!.addEventListener('click', clearRestTimer);
}
