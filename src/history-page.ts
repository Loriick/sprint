import { deleteResult, formatTime, getHistory, speedKmh } from './history';
import { router } from './router';
import { showScreen } from './screens';

const historyPageList = document.getElementById('history-page-list') as HTMLElement;
const historyTabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const historyStatBest = document.getElementById('history-stat-best') as HTMLElement;
const historyStatAvg = document.getElementById('history-stat-avg') as HTMLElement;
const historyStatCount = document.getElementById('history-stat-count') as HTMLElement;
const historyChart = document.getElementById('history-chart') as HTMLElement;

function renderHistoryPage(distFilter: string): void {
  historyTabs.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.dist === distFilter);
  });

  const history = getHistory().filter((h) => distFilter === 'all' || String(h.dist) === distFilter);

  const best = history.length ? Math.min(...history.map((h) => h.timeMs)) : null;
  historyStatBest.textContent = best == null ? '–' : formatTime(best);
  historyStatAvg.textContent = history.length
    ? formatTime(history.reduce((sum, h) => sum + h.timeMs, 0) / history.length)
    : '–';
  historyStatCount.textContent = String(history.length);

  // chronological order (oldest first) for the chart
  const chronological = [...history].reverse();
  const speeds = chronological.map((h) => speedKmh(h.dist, h.timeMs));
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const minSpeed = speeds.length ? Math.min(...speeds) : 0;
  const range = maxSpeed - minSpeed;
  historyChart.innerHTML = chronological.map((h, i) => {
    const speed = speeds[i];
    const heightPct = range === 0 ? 100 : 32 + (speed - minSpeed) / range * 68;
    const isBest = best !== null && h.timeMs === best;
    return `
      <div class="history-chart-bar${isBest ? ' best' : ''}" style="height:${heightPct}%">
        <span class="history-chart-bar-label">${formatTime(h.timeMs)}</span>
      </div>`;
  }).join('');

  if (!history.length) {
    historyPageList.innerHTML = '<p class="empty-history">Aucun résultat</p>';
    return;
  }

  historyPageList.innerHTML = history.map((h) => {
    const d = new Date(h.date);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const isBest = best !== null && h.timeMs === best;
    return `
      <div class="history-item${isBest ? ' is-best' : ''}">
        <div class="item-info">
          <span class="dist-label">${h.dist} yards</span>
          <span class="date-label">${dateStr}</span>
        </div>
        <span class="time-val">${formatTime(h.timeMs)}</span>
        <span class="speed-label">${speedKmh(h.dist, h.timeMs).toFixed(1)} km/h</span>
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
