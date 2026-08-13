import type { Roi } from './types.ts';

/**
 * ROI par défaut pour le placement actuel : le téléphone est posé à l'arrivée,
 * face à l'athlète qui vient vers lui.
 *
 * La ligne d'arrivée est une bande verticale étroite au centre : l'athlète la
 * franchit en occupant toute la hauteur du cadre, donc la détection est franche.
 *
 * La zone de départ est une bande horizontale dans le tiers supérieur, là où se
 * trouve l'athlète au loin. Le départ n'a pas besoin d'être localisé
 * précisément dans l'espace — seulement dans le temps : il suffit de constater
 * que l'athlète s'est mis en mouvement. C'est ce qui permet de mesurer un
 * départ sans déplacer le téléphone ni en ajouter un second.
 */
export const DEFAULT_FINISH_ROI: Roi = { x: 0.46, y: 0, w: 0.08, h: 1 };
export const DEFAULT_START_ROI: Roi = { x: 0.15, y: 0.16, w: 0.7, h: 0.22 };

/** Ramène une ROI dans le cadre, en garantissant une largeur et hauteur non nulles. */
export function clampRoi(roi: Roi): Roi {
  const x = clamp01(roi.x);
  const y = clamp01(roi.y);
  const w = Math.max(0.01, Math.min(1 - x, roi.w));
  const h = Math.max(0.01, Math.min(1 - y, roi.h));
  return { x, y, w, h };
}

function clamp01(v: number): number {
  if (!isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
