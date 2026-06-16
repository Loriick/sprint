import { getAudioCtx } from './audio';
import { startCamera } from './camera';
import { formatTime, getHistory } from './history';
import { router } from './router';
import { showScreen } from './screens';
import { state } from './state';

const historyList = document.getElementById('history-list') as HTMLElement;

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

export function init(): void {
  document.querySelector(`.dist-btn[data-dist="${state.distance}"]`)!.classList.add('active');

  document.querySelectorAll<HTMLButtonElement>('.dist-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dist-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.distance = parseInt(btn.dataset.dist as string);
    });
  });

  document.getElementById('btn-start')!.addEventListener('click', async () => {
    // Unlock audio context on user gesture
    getAudioCtx();
    await startCamera();
  });

  router.on('/', () => {
    renderHistory();
    showScreen('home');
  });
}
