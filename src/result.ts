import { startCamera, stopCamera } from './camera';
import { router } from './router';

const shareToast = document.getElementById('share-toast') as HTMLElement;
let toastTimer: number | null = null;

function buildShareText(): string {
  const distance = (document.getElementById('result-distance') as HTMLElement).textContent || '';
  const time = (document.getElementById('result-time') as HTMLElement).textContent || '';
  const speedUnit = (document.querySelector('#screen-result .result-stat-unit') as HTMLElement)?.textContent || '';
  const speedVal = (document.getElementById('result-speed-primary') as HTMLElement).textContent || '';
  return `Sprint Timer — ${distance} : ${time} (${speedVal} ${speedUnit})`;
}

async function shareResult(): Promise<void> {
  const text = buildShareText();
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }
  showToast();
}

function showToast(): void {
  if (toastTimer !== null) clearTimeout(toastTimer);
  shareToast.classList.remove('hidden');
  shareToast.classList.add('visible');
  toastTimer = window.setTimeout(() => {
    shareToast.classList.remove('visible');
    shareToast.classList.add('hidden');
  }, 1800);
}

export function init(): void {
  document.getElementById('btn-retry')!.addEventListener('click', async () => {
    await startCamera();
  });

  document.getElementById('btn-share')!.addEventListener('click', () => {
    shareResult();
  });

  document.getElementById('btn-home')!.addEventListener('click', () => {
    stopCamera();
    router.navigate('/');
  });
}
