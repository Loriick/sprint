# Plan — app mobile et chronométrage départ/arrivée

État au moment de la rédaction : une PWA (`src/`) et une app Expo (`native/`) qui
implémentent chacune leur propre détection de mouvement, déjà désynchronisées.

## Décisions

| Sujet | Décision |
|---|---|
| Cible mobile | Expo natif (`native/`) devient le produit principal, la PWA reste la démo sans installation. Un noyau TS pur `core/` est partagé par les deux. |
| Départ | Mode B2 : départ auto-détecté dans le même cadre que l'arrivée. Le téléphone ne bouge pas de sa position actuelle. |
| Détection | ROI réglable + fond adaptatif + profil 1D + hystérésis + interpolation sub-frame. Pas de ML pour l'instant. |

## Problèmes traités

1. **Le départ n'était pas mesuré.** Le chrono partait au bip « GO »
   (`src/camera.ts:110`, `native/screens/CameraScreen.tsx:226`), donc le temps
   mesuré incluait le temps de réaction de l'athlète — arbitraire en auto-départ.
2. **Le timestamp d'arrivée était biaisé.** Le worklet prenait `Date.now()` au
   moment du *traitement* de la frame, pas de sa *capture*
   (`native/screens/CameraScreen.tsx:152`), injectant la latence du pipeline
   caméra (30–80 ms, variable) dans le résultat.
3. **La détection native regardait toute l'image** (48×48 sur le cadre entier),
   donc n'importe quel mouvement dans le champ déclenchait l'arrivée.
4. **Aucune adaptation à la lumière** après les 10 frames de warmup : une
   variation d'auto-exposition suffisait à produire un faux positif.
5. **Résolution temporelle plafonnée** : 60 fps en PWA (`requestAnimationFrame`),
   format caméra par défaut (souvent 30 fps) en natif.
6. **Code dupliqué et divergent** entre les deux implémentations.

## Architecture

```
core/                     TS pur, zéro dépendance plateforme
  src/types.ts            ROI, événements, réglages, entrées d'historique
  src/frame-clock.ts      normalise les timestamps de capture en ms monotones
  src/detector.ts         détecteur de franchissement sur une ROI
  src/run-timing.ts       machine à états d'un sprint (armed → running → done)
  src/speed.ts            distances, vitesses, formatage
  src/history.ts          historique pur (storage injecté)
  test/                   séquences synthétiques, exécutées par `node --test`

src/                      PWA — consomme core via l'alias @core (vite)
native/                   Expo — consomme core via metro watchFolders + alias
```

Le noyau ne connaît ni le DOM, ni React Native : il reçoit des buffers de pixels
et des timestamps, il renvoie des événements. C'est ce qui permet de le tester
sans appareil et de garantir que les deux applications mesurent la même chose.

## Algorithme de détection

Pour chaque ROI, à chaque frame :

1. **Profil 1D.** La ROI est réduite à un vecteur d'une valeur de luminance par
   colonne (moyenne sur la hauteur). Moyenner sur la hauteur annule le bruit du
   capteur, et le vecteur est court, donc les étapes suivantes sont négligeables
   en coût.
2. **Fond adaptatif.** `bg[i] += α · (profil[i] − bg[i])`. Les variations lentes
   (nuage, auto-exposition qui se réajuste) sont absorbées par le fond ; un
   passage rapide ne l'est pas. L'adaptation est **gelée** pendant qu'un
   événement est en cours, sinon le passage se ferait absorber par le fond.
3. **Énergie.** `E = moyenne(|profil[i] − bg[i]|)`, exprimée en niveaux 0–255,
   donc comparable au seuil dérivé de la sensibilité.
4. **Hystérésis.** Seuil haut pour armer, seuil bas (60 %) pour désarmer, plus
   un nombre de frames consécutives requis. Empêche le clignotement autour du
   seuil de compter comme plusieurs franchissements.
5. **Interpolation sub-frame.** Le franchissement du seuil se produit entre deux
   frames. `frac = (T − E[n−1]) / (E[n] − E[n−1])` situe l'instant réel dans
   l'intervalle. À 60 fps, cela ramène l'erreur de ±16 ms à quelques ms.

## Machine à états (mode départ auto)

```
idle → countdown → armed → running → done
                    │        │
                    │        └─ mouvement dans la ROI « arrivée » → t1
                    └─ mouvement dans la ROI « départ » → t0
```

Temps final = `t1 − t0`, les deux horodatés sur la même horloge de capture.

Garde-fous :

- **`MIN_RUN_MS`** — un franchissement d'arrivée plus tôt que ce délai après le
  départ est ignoré : c'est le mouvement de départ qui a bavé dans la ROI
  d'arrivée.
- **`START_WINDOW_MS`** — si aucun départ n'est détecté dans cette fenêtre après
  le GO, on retombe sur l'instant du GO comme `t0` et le résultat est marqué
  `startMode: 'go'`, pour ne pas perdre l'essai.
- **`MAX_RUN_MS`** — abandon si rien ne franchit jamais l'arrivée (déjà présent).

Le mode « GO » historique reste disponible en réglage : l'historique enregistre
le mode utilisé pour chaque essai, sinon on comparerait des mesures qui ne
mesurent pas la même chose.

## ROI par défaut (caméra à l'arrivée, position actuelle)

- **Arrivée** — bande verticale centrale, 8 % de largeur, toute la hauteur.
  C'est déjà ce que faisait la PWA.
- **Départ** — bande horizontale dans le tiers supérieur du cadre, où se trouve
  l'athlète au loin. Le départ n'a pas besoin de précision *spatiale*, seulement
  *temporelle* : il suffit de détecter que l'athlète a bougé.

## Horloge de capture

`frame.timestamp` de VisionCamera n'a pas la même unité selon la plateforme et
la version. Plutôt que de coder en dur une hypothèse invérifiable ici,
`FrameClock` **déduit l'échelle** en comparant les écarts entre frames
successives à l'intervalle attendu pour le framerate courant, puis convertit en
millisecondes monotones. Si les timestamps sont inutilisables, il retombe sur
l'horloge murale en le signalant.

## Étapes

1. `core/` + tests sur séquences synthétiques (fond bruité, rampe de luminosité,
   sujet traversant) — vérifiable sans appareil.
2. Intégration PWA : `src/camera.ts` branché sur le core, deux ROI, départ auto.
3. Intégration native : `metro.config.js`, `CameraScreen` réécrit sur le core,
   timestamps de capture, sélection d'un format haut framerate.
4. Réglages : choix du mode de départ, sensibilité appliquée aux deux ROI.

## Plus tard

- **Deux téléphones synchronisés** (option C) pour du chronométrage à deux
  points : synchro d'horloge type SNTP sur BLE ou WiFi local. Le bip de départ
  peut servir de signal de synchro audio, avec correction du temps de vol du son
  puisque la distance est déjà connue de l'app.
- **Détection de personne (TFLite/MoveNet)** pour valider qu'un humain franchit
  la ligne, en gardant le détecteur pixel pour le timing fin.
- **Formats 120/240 fps** avec verrouillage d'exposition et de balance des
  blancs, et stabilisation vidéo désactivée.
