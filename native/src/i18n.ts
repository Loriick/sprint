import { useStore } from './store';
import type { Lang } from './types';

const STR: Record<string, Record<Lang, string>> = {
  home_kicker: { fr: 'CHOISIR LA DISTANCE', en: 'CHOOSE DISTANCE' },
  home_start: { fr: 'DÉMARRER', en: 'START' },
  home_recent: { fr: 'Derniers résultats', en: 'Recent results' },
  home_seeall: { fr: 'Voir tout →', en: 'See all →' },
  home_settings: { fr: 'Réglages', en: 'Settings' },
  home_empty_history: { fr: 'Aucun résultat encore', en: 'No runs yet' },

  cam_finish_line: { fr: "LIGNE D'ARRIVÉE", en: 'FINISH LINE' },
  cam_get_ready: { fr: 'PRÉPAREZ-VOUS', en: 'GET READY' },
  cam_go_label: { fr: 'EN POSITION · PARTEZ !', en: 'GET SET · GO!' },
  cam_instruction: { fr: "Placez la caméra face à la ligne d'arrivée.", en: 'Point the camera at the finish line.' },
  cam_distance_label: { fr: 'Distance :', en: 'Distance:' },
  cam_cancel: { fr: '✕ Annuler', en: '✕ Cancel' },
  cam_error: { fr: "Impossible d'accéder à la caméra.", en: 'Could not access the camera.' },

  result_pb: { fr: '★ Nouveau record', en: '★ New record' },
  result_speed: { fr: 'Vitesse', en: 'Speed' },
  result_vsbest: { fr: 'vs record', en: 'vs best' },
  result_record_word: { fr: '★ Record', en: '★ Best' },
  result_previous: { fr: 'Ancien :', en: 'Previous:' },
  result_record: { fr: 'Record :', en: 'Best:' },
  result_retry_label: { fr: 'Relancer', en: 'Run again' },
  result_home_label: { fr: 'Accueil', en: 'Home' },
  result_share_label: { fr: 'Partager', en: 'Share' },
  result_share_toast: { fr: 'Résultat copié !', en: 'Result copied!' },

  settings_title: { fr: 'Réglages', en: 'Settings' },
  settings_sensitivity: { fr: 'Sensibilité de détection', en: 'Detection sensitivity' },
  settings_low: { fr: 'Bas (10–25)', en: 'Low (10–25)' },
  settings_low_desc: { fr: '→ très réactif, risque de faux départ.', en: '→ very reactive, risk of false start.' },
  settings_high: { fr: 'Haut (40–80)', en: 'High (40–80)' },
  settings_high_desc: { fr: '→ moins réactif, pour environnements avec beaucoup de mouvement.', en: '→ less reactive, for busy environments.' },
  settings_preview_label: { fr: 'Aperçu mouvement', en: 'Live motion' },
  settings_preview_label2: { fr: 'en direct', en: 'preview' },
  settings_back: { fr: '← Retour', en: '← Back' },
  settings_units: { fr: 'Unités', en: 'Units' },
  settings_sound: { fr: 'Son', en: 'Sound' },
  settings_haptics: { fr: 'Vibrations', en: 'Haptics' },

  history_title: { fr: 'Historique', en: 'History' },
  history_back: { fr: '← Retour', en: '← Back' },
  history_tab_all: { fr: 'Tous', en: 'All' },
  history_stat_best: { fr: 'Record', en: 'Best' },
  history_stat_avg: { fr: 'Moyenne', en: 'Average' },
  history_stat_count: { fr: 'Sprints', en: 'Runs' },
  history_chart_title: { fr: 'Progression', en: 'Progress' },
  history_chart_caption: { fr: 'plus rapide = plus haut', en: 'faster = taller' },
  history_empty: { fr: 'Aucun résultat', en: 'No runs' },

  delete_title: { fr: 'Supprimer ce résultat ?', en: 'Delete this run?' },
  delete_message: { fr: 'Cette action est irréversible.', en: 'This action cannot be undone.' },
  delete_confirm: { fr: 'Supprimer', en: 'Delete' },
  delete_cancel: { fr: 'Annuler', en: 'Cancel' },

  picker_title: { fr: 'Compte à rebours', en: 'Countdown' },
  picker_subtitle: { fr: 'Faites défiler pour choisir', en: 'Scroll to choose' },
  picker_confirm: { fr: 'Démarrer →', en: 'Start →' },
  picker_cancel: { fr: 'Annuler', en: 'Cancel' },
};

/** Call inside React components or pass lang explicitly. */
export function t(key: string, lang?: Lang): string {
  const l = lang ?? useStore.getState().lang;
  return STR[key] ? STR[key][l] : key;
}

export function getLang(): Lang {
  return useStore.getState().lang;
}
