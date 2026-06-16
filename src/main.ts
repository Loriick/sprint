import * as camera from './camera';
import * as historyPage from './history-page';
import * as home from './home';
import { applyI18n } from './i18n';
import * as modal from './modal';
import { router } from './router';
import * as result from './result';
import * as settings from './settings';

home.init();
historyPage.init();
settings.init();
camera.init();
result.init();
modal.init();

applyI18n();
router.start();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
