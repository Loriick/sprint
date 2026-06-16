import { startCamera, stopCamera } from './camera';
import { router } from './router';

export function init(): void {
  document.getElementById('btn-retry')!.addEventListener('click', async () => {
    await startCamera();
  });

  document.getElementById('btn-home')!.addEventListener('click', () => {
    stopCamera();
    router.navigate('/');
  });
}
