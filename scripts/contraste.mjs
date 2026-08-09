/**
 * Calcule les rapports de contraste WCAG des variantes claires.
 *
 * DESIGN.md prévient : « une variante qui n'a pas été rendue n'a pas été vérifiée ». Ce
 * script est la version mesurable de cet avertissement — il refuse de croire une palette
 * sur parole.
 */

const luminance = (hex) => {
  const n = hex.replace("#", "");
  const plein =
    n.length === 3
      ? n
          .split("")
          .map((c) => c + c)
          .join("")
      : n;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(plein.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Les paires qui comptent, avec leur minimum. 4,5 pour du texte, 3 pour une bordure. */
const PAIRES = [
  ["text", "bg", 4.5],
  ["text", "surface", 4.5],
  ["text", "surface-raised", 4.5],
  ["text-muted", "bg", 4.5],
  ["text-muted", "surface", 4.5],
  ["text-muted", "surface-raised", 4.5],
  ["accent-text", "surface", 4.5],
  ["accent-text", "bg", 4.5],
  ["on-accent", "accent", 4.5],
  ["score-author", "surface-raised", 4.5],
  ["score-reader", "surface-raised", 4.5],
  ["positive", "surface", 4.5],
  ["negative", "surface", 4.5],
  ["border", "surface", 3],
];

export function verifier(nom, p) {
  let echecs = 0;
  const lignes = [];

  for (const [avant, arriere, minimum] of PAIRES) {
    const r = ratio(p[avant], p[arriere]);
    const ok = r >= minimum;
    if (!ok) echecs += 1;
    lignes.push(
      `   ${ok ? "✓" : "✗"} ${(avant + " / " + arriere).padEnd(30)} ${r.toFixed(2).padStart(5)} : 1  (min ${minimum})`,
    );
  }

  console.log(`\n${nom} — ${echecs === 0 ? "conforme AA" : echecs + " ÉCHEC(S)"}`);
  for (const l of lignes) {
    if (echecs === 0 && l.includes("✓")) continue;
    console.log(l);
  }
  if (echecs === 0) {
    const pire = PAIRES.map(([a, b]) => ratio(p[a], p[b])).sort((x, y) => x - y)[0];
    console.log(`   le plus serré : ${pire.toFixed(2)} : 1`);
  }

  return echecs;
}
