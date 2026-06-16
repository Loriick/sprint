import type { ScreenName } from './types';

const screens: Record<ScreenName, HTMLElement> = {
  home: document.getElementById('screen-home') as HTMLElement,
  camera: document.getElementById('screen-camera') as HTMLElement,
  result: document.getElementById('screen-result') as HTMLElement,
  settings: document.getElementById('screen-settings') as HTMLElement,
  history: document.getElementById('screen-history') as HTMLElement,
};

export function showScreen(name: ScreenName): void {
  (Object.entries(screens) as [ScreenName, HTMLElement][]).forEach(([k, el]) => {
    el.classList.toggle('hidden', k !== name);
  });
}
