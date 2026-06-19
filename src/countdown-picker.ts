import { getAudioCtx } from './audio';
import { startCamera } from './camera';
import { state } from './state';

const DURATIONS = [3, 5, 10, 15, 30];
const ITEM_HEIGHT = 56;

const overlay = document.getElementById('countdown-picker-modal') as HTMLElement;
const drum = document.getElementById('drum-picker') as HTMLElement;
const btnConfirm = document.getElementById('picker-confirm') as HTMLButtonElement;
const btnCancel = document.getElementById('picker-cancel') as HTMLButtonElement;

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

  btnConfirm.addEventListener('click', async () => {
    hidePicker();
    getAudioCtx();
    await startCamera();
  });

  btnCancel.addEventListener('click', () => {
    hidePicker();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hidePicker();
  });
}
