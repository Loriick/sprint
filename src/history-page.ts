import { deleteResult, formatTime, getHistory } from './history';
import { router } from './router';
import { showScreen } from './screens';

const historyPageList = document.getElementById('history-page-list') as HTMLElement;
const historyTabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');

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

export function init(): void {
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

  router.on('/history', () => {
    renderHistoryPage('all');
    showScreen('history');
  });

  router.on('/history/:dist', (params) => {
    renderHistoryPage(params.dist);
    showScreen('history');
  });
}
