import type { FrameBuffer, Roi } from './types.ts';

/**
 * Réduction d'une ROI à un profil 1D : une valeur de luminance par colonne,
 * moyennée sur les lignes échantillonnées.
 *
 * Moyenner sur la hauteur annule le bruit du capteur, qui est indépendant d'un
 * pixel à l'autre, alors qu'un sujet qui traverse affecte toute la colonne en
 * même temps. Le nombre de colonnes et de lignes échantillonnées est fixe, donc
 * le profil — et le seuil qui lui est comparé — ne dépendent pas de la
 * résolution de la caméra : la PWA en 1280×720 et le natif en 160×90 produisent
 * des profils comparables.
 *
 * La directive 'worklet' permet d'appeler cette fonction depuis un frame
 * processor VisionCamera. Elle est sans effet sur les autres plateformes.
 */
export function computeProfile(
  frame: FrameBuffer,
  roi: Roi,
  out: Float32Array,
  rowSamples: number,
): void {
  'worklet';

  const { data, width, height, channels } = frame;
  const cols = out.length;

  // Bornes en pixels, clampées pour tolérer une ROI qui déborde du cadre.
  let x0 = Math.round(roi.x * width);
  let y0 = Math.round(roi.y * height);
  let x1 = Math.round((roi.x + roi.w) * width);
  let y1 = Math.round((roi.y + roi.h) * height);
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 > width) x1 = width;
  if (y1 > height) y1 = height;

  const roiW = x1 - x0;
  const roiH = y1 - y0;
  if (roiW <= 0 || roiH <= 0) {
    for (let i = 0; i < cols; i++) out[i] = 0;
    return;
  }

  const rows = rowSamples < roiH ? rowSamples : roiH;

  for (let c = 0; c < cols; c++) {
    // Centre de la c-ième tranche de colonnes, pour ne pas biaiser vers le bord.
    const px = x0 + Math.floor(((c + 0.5) * roiW) / cols);
    let sum = 0;

    for (let r = 0; r < rows; r++) {
      const py = y0 + Math.floor(((r + 0.5) * roiH) / rows);
      const idx = (py * width + px) * channels;
      // Luma entière (coefficients Rec. 601 × 256) : pas de flottant dans la
      // boucle chaude, qui tourne à 120 fps sur le thread caméra.
      sum += (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
    }

    out[c] = sum / rows;
  }
}
