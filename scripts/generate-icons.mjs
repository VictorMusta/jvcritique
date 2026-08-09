import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * Génère les icônes de la PWA et le favicon depuis une source vectorielle.
 *
 * Chrome n'affiche l'invite d'installation que si le manifeste déclare au moins une icône
 * 192×192 et une 512×512 en PNG. Un `favicon.ico` de 48 px ne suffit pas.
 *
 * Le dessin est en SVG et non en image matricielle : une icône doit rester nette du favicon
 * de 16 px à la tuile de 512, et un seul fichier source évite qu'une taille dérive des
 * autres au fil des retouches.
 *
 * Script lancé à la main (`node scripts/generate-icons.mjs`), pas à chaque build : les
 * fichiers produits sont commités.
 */

const NUIT = "#111827"; // fond, et creux de la manette
const CLAIR = "#F7F7F5"; // bulle de dialogue
const ETOILE = "#F9A31B"; // étoile et étincelles

/**
 * Manette de jeu dans une bulle de dialogue, surmontée d'une étoile.
 *
 * @param size    côté de l'image en pixels
 * @param inset   marge autour du dessin, en fraction du côté. Les variantes `maskable`
 *                en demandent davantage : Android recadre en cercle ou en goutte selon le
 *                lanceur, et sans marge les bords du dessin sont rognés.
 * @param rounded true pour le carré arrondi de l'icône, false pour un fond transparent
 */
const icone = (size, inset, rounded) => {
  const m = size * inset;
  const w = size - m * 2;
  // Coordonnées exprimées en pourcentage du dessin, pour rester lisibles.
  const x = (p) => m + (p / 100) * w;
  const y = (p) => m + (p / 100) * w;

  // Étoile à cinq branches, centrée, rayon externe r.
  const etoile = (cx, cy, r) => {
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const rayon = i % 2 === 0 ? r : r * 0.45;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${cx + rayon * Math.cos(angle)},${cy + rayon * Math.sin(angle)}`);
    }
    return pts.join(" ");
  };

  const pointsEtoile = etoile(x(70), y(28), w * 0.19);

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${rounded ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${NUIT}"/>` : ""}

  <!-- Bulle de dialogue : le corps, puis la queue en bas à gauche. -->
  <g fill="${CLAIR}">
    <rect x="${x(14)}" y="${y(36)}" width="${w * 0.72}" height="${w * 0.42}" rx="${w * 0.21}"/>
    <path d="M ${x(26)} ${y(70)} L ${x(20)} ${y(90)} L ${x(42)} ${y(74)} Z"/>
  </g>

  <!-- Croix directionnelle, évidée dans la bulle. -->
  <g fill="${NUIT}">
    <rect x="${x(26)}" y="${y(51)}" width="${w * 0.17}" height="${w * 0.062}" rx="${w * 0.026}"/>
    <rect x="${x(31.4)}" y="${y(45.6)}" width="${w * 0.062}" height="${w * 0.17}" rx="${w * 0.026}"/>
  </g>

  <!-- Les quatre boutons, en losange. -->
  <g fill="${NUIT}">
    <circle cx="${x(66)}" cy="${y(48)}" r="${w * 0.035}"/>
    <circle cx="${x(58)}" cy="${y(54)}" r="${w * 0.035}"/>
    <circle cx="${x(74)}" cy="${y(54)}" r="${w * 0.035}"/>
    <circle cx="${x(66)}" cy="${y(60)}" r="${w * 0.035}"/>
  </g>

  <!-- Étoile : d'abord un contour épais de la couleur du fond, pour la détacher de la
       bulle qu'elle chevauche, puis le remplissage. -->
  <polygon points="${pointsEtoile}" fill="none" stroke="${NUIT}" stroke-width="${w * 0.055}" stroke-linejoin="round"/>
  <polygon points="${pointsEtoile}" fill="${ETOILE}"/>

  <!-- Trois étincelles, en éventail au-dessus à gauche de l'étoile. -->
  <g stroke="${ETOILE}" stroke-width="${w * 0.026}" stroke-linecap="round">
    <line x1="${x(50)}" y1="${y(10)}" x2="${x(54)}" y2="${y(17)}"/>
    <line x1="${x(41)}" y1="${y(17)}" x2="${x(48)}" y2="${y(22)}"/>
    <line x1="${x(37)}" y1="${y(27)}" x2="${x(45)}" y2="${y(28)}"/>
  </g>
</svg>`);
};

await mkdir("public/icons", { recursive: true });

for (const size of [192, 512]) {
  await sharp(icone(size, 0.04, true)).png().toFile(`public/icons/icone-${size}.png`);

  // Zone sûre d'Android : un cercle de 80 % du côté. D'où une marge nettement plus large.
  await sharp(icone(size, 0.16, true))
    .png()
    .toFile(`public/icons/icone-maskable-${size}.png`);
}

// Favicon multi-résolutions. 32 px est la taille réellement affichée dans un onglet ;
// le 16 px sert aux affichages compacts et aux favoris.
await sharp(icone(180, 0.04, true)).png().toFile("public/icons/apple-touch-icon.png");
await sharp(icone(32, 0.02, true)).png().toFile("public/favicon.png");

const manifest = {
  name: "jvcritiqué",
  short_name: "jvcritiqué",
  description: "Les avis de jeux de tes potes, notés selon TES critères.",
  lang: "fr",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: NUIT,
  theme_color: NUIT,
  icons: [
    { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    {
      src: "/icons/icone-maskable-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/icons/icone-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

await writeFile(
  "public/manifest.webmanifest",
  JSON.stringify(manifest, null, 2) + "\n",
);

console.log("icônes, favicon et manifeste écrits dans public/");
