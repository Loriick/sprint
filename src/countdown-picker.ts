import { unlockAudio } from './audio';
import { startCamera } from './camera';
import { state } from './state';

const DURATIONS = [3, 5, 10, 15, 30];
const ITEM_HEIGHT = 56;

const MAX_SPRINTS = 10;
const REST_STEP = 15; // seconds
const REST_MIN = 15;
const REST_MAX = 300;

const overlay = document.getElementById('countdown-picker-modal') as HTMLElement;
const drum = document.getElementById('drum-picker') as HTMLElement;
const btnConfirm = document.getElementById('picker-confirm') as HTMLButtonElement;
const btnCancel = document.getElementById('picker-cancel') as HTMLButtonElement;
const sprintsCount = document.getElementById('sprints-count') as HTMLElement;
const restVal = document.getElementById('rest-val') as HTMLElement;
const restRow = document.getElementById('rest-row') as HTMLElement;

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function syncSeriesConfig(): void {
  sprintsCount.textContent = String(state.seriesTotal);
  restVal.textContent = formatRest(state.restDuration);
  // Rest is meaningless for a single sprint
  restRow.classList.toggle('disabled', state.seriesTotal <= 1);
}

function renderItems(): void {
  drum.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    drum.insertAdjacentHTML('beforeend', '<div class="drum-item drum-spacer"></div>');
  }
  DURATIONS.forEach((val) => {
    drum.insertAdjacentHTML('beforeend', `<div class="drum-item" data-val="${val}">${val}<span class="drum-unit">s</span></div>`);
  });
  for (let i = 0; i < 2; i++) {
    drum.insertAdjacentHTML('beforeend', '<div class="drum-item drum-spacer"></div>');
  }
}

function getSelectedIndex(): number {
  return Math.round(drum.scrollTop / ITEM_HEIGHT);
}

function scrollToIndex(index: number, smooth = false): void {
  drum.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'instant' });
}

function updateSelection(): void {
  const idx = getSelectedIndex();
  drum.querySelectorAll<HTMLElement>('.drum-item[data-val]').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });
  const duration = DURATIONS[Math.min(Math.max(idx, 0), DURATIONS.length - 1)];
  state.countdownDuration = duration;
  localStorage.setItem('countdownDuration', String(duration));
}

export function showPicker(): void {
  renderItems();
  overlay.classList.remove('hidden');
  overlay.getBoundingClientRect();
  overlay.classList.add('visible');

  const idx = DURATIONS.indexOf(state.countdownDuration);
  scrollToIndex(idx >= 0 ? idx : 1);
  updateSelection();
  syncSeriesConfig();
  btnConfirm.focus();
}

function hidePicker(): void {
  overlay.classList.add('hidden');
  overlay.classList.remove('visible');
}

export function init(): void {
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;

  drum.addEventListener('scroll', () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const idx = getSelectedIndex();
      scrollToIndex(idx, true);
      updateSelection();
    }, 80);
  });

  document.getElementById('sprints-minus')!.addEventListener('click', () => {
    state.seriesTotal = Math.max(1, state.seriesTotal - 1);
    localStorage.setItem('seriesTotal', String(state.seriesTotal));
    syncSeriesConfig();
  });

  document.getElementById('sprints-plus')!.addEventListener('click', () => {
    state.seriesTotal = Math.min(MAX_SPRINTS, state.seriesTotal + 1);
    localStorage.setItem('seriesTotal', String(state.seriesTotal));
    syncSeriesConfig();
  });

  document.getElementById('rest-minus')!.addEventListener('click', () => {
    state.restDuration = Math.max(REST_MIN, state.restDuration - REST_STEP);
    localStorage.setItem('restDuration', String(state.restDuration));
    syncSeriesConfig();
  });

  document.getElementById('rest-plus')!.addEventListener('click', () => {
    state.restDuration = Math.min(REST_MAX, state.restDuration + REST_STEP);
    localStorage.setItem('restDuration', String(state.restDuration));
    syncSeriesConfig();
  });

  btnConfirm.addEventListener('click', async () => {
    hidePicker();
    state.seriesIndex = 1;
    await unlockAudio();
    await startCamera();
  });

  btnCancel.addEventListener('click', () => {
    hidePicker();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hidePicker();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('visible')) hidePicker();
  });
}
