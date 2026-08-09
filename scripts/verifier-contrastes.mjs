import { verifier } from "./contraste.mjs";

/**
 * Nouvelles variantes claires.
 *
 * Trois changements de fond par rapport aux précédentes :
 *
 * 1. Le fond et les surfaces sont TEINTÉS vers l'univers, au lieu d'un blanc pur partagé par
 *    les quatre. C'était la cause du « elles se ressemblent toutes ».
 * 2. `accent-text` est un accent ASSOMBRI, réservé au texte. L'accent de marque reste sur les
 *    fonds de bouton, où il a du contraste face à `on-accent`.
 * 3. Les bordures montent à 3 : 1 — elles délimitent des champs de saisie, donc ce n'est pas
 *    décoratif. Effet de bord bienvenu : une bordure teintée visible donne du caractère.
 */
const claires = {
  "potion-light": {
    bg: "#f2e9d8", surface: "#fbf6ec", "surface-raised": "#ecdfc7", border: "#8c7550",
    text: "#2a211a", "text-muted": "#6b5940", accent: "#8a5316", "accent-text": "#7a4a12",
    "score-author": "#2a211a", "score-reader": "#2f6b4c", positive: "#4f7a3e",
    negative: "#9b3b27", "on-accent": "#fbf6ec",
  },
  "lol-light": {
    bg: "#e4ecf9", surface: "#f5f8fd", "surface-raised": "#d2e0f2", border: "#6a83a6",
    text: "#0a1428", "text-muted": "#4b5a75", accent: "#7a5f1c", "accent-text": "#6b5316",
    "score-author": "#0a1428", "score-reader": "#0a5f58", positive: "#2f6b4c",
    negative: "#a33228", "on-accent": "#f5f8fd",
  },
  "overwatch-light": {
    bg: "#fbeedd", surface: "#fff8f0", "surface-raised": "#f4e0c8", border: "#9d7442",
    text: "#14181c", "text-muted": "#5d5148", accent: "#9a5800", "accent-text": "#8a4f00",
    "score-author": "#14181c", "score-reader": "#175fa8", positive: "#1f7a55",
    negative: "#c22a2a", "on-accent": "#fff8f0",
  },
  "rocket-light": {
    bg: "#e2edfb", surface: "#f4f9ff", "surface-raised": "#cde0f8", border: "#628cc0",
    text: "#06090f", "text-muted": "#48586f", accent: "#0b5bbf", "accent-text": "#0a51a8",
    "score-author": "#06090f", "score-reader": "#086673", positive: "#157f4f",
    negative: "#c7304a", "on-accent": "#f4f9ff",
  },
  "cs-light": {
    bg: "#efe9da", surface: "#f9f5ec", "surface-raised": "#e3dac4", border: "#877553",
    text: "#121417", "text-muted": "#5a5346", accent: "#8a5a08", "accent-text": "#7a5006",
    "score-author": "#121417", "score-reader": "#2d567c", positive: "#4f7a3e",
    negative: "#a83a2c", "on-accent": "#f9f5ec",
  },
};

console.log("========== NOUVELLES VARIANTES CLAIRES ==========");
let total = 0;
for (const [nom, p] of Object.entries(claires)) total += verifier(nom, p);
console.log(`\n>>> ${total} échec(s) au total`);

/** Variantes sombres, inchangées, avec `accent-text` = `accent`. */
const sombres = {
  "potion-dark": { bg:"#171310", surface:"#221b16", "surface-raised":"#2c231c", border:"#7a634a",
    text:"#efe3d0", "text-muted":"#a8937a", accent:"#c98a3c", "accent-text":"#c98a3c",
    "score-author":"#efe3d0", "score-reader":"#86b79a", positive:"#7fa86b", negative:"#e5907a",
    "on-accent":"#171310" },
  "lol-dark": { bg:"#0a1428", surface:"#0f1f38", "surface-raised":"#16294a", border:"#4a6f9e",
    text:"#f0e6d2", "text-muted":"#a09b8c", accent:"#c8aa6e", "accent-text":"#c8aa6e",
    "score-author":"#f0e6d2", "score-reader":"#0ac8b9", positive:"#4e9e7f", negative:"#f08880",
    "on-accent":"#0a1428" },
  "overwatch-dark": { bg:"#14181c", surface:"#1e2429", "surface-raised":"#272f35", border:"#68757e",
    text:"#ffffff", "text-muted":"#a3aaaf", accent:"#f99e1a", "accent-text":"#f99e1a",
    "score-author":"#ffffff", "score-reader":"#63b0ff", positive:"#43b581", negative:"#ff8080",
    "on-accent":"#14181c" },
  "rocket-dark": { bg:"#06090f", surface:"#0d1522", "surface-raised":"#132038", border:"#476892",
    text:"#e9f2ff", "text-muted":"#7e90a8", accent:"#0e7bff", "accent-text":"#0e7bff",
    "score-author":"#ff8c1a", "score-reader":"#00e0ff", positive:"#22d07a", negative:"#ff3b5c",
    "on-accent":"#06090f" },
  "cs-dark": { bg:"#121417", surface:"#1b1f23", "surface-raised":"#23282d", border:"#616c76",
    text:"#dce3e8", "text-muted":"#8a939b", accent:"#e8a33d", "accent-text":"#e8a33d",
    "score-author":"#dce3e8", "score-reader":"#6c9fd8", positive:"#7ba05b", negative:"#f0907f",
    "on-accent":"#121417" },
};

console.log("\n========== VARIANTES SOMBRES ==========");
let ts = 0;
for (const [nom, p] of Object.entries(sombres)) ts += verifier(nom, p);
console.log(`\n>>> ${ts} échec(s) côté sombre`);
