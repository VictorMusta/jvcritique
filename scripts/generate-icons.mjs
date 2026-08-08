import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * Génère les icônes de la PWA depuis une source vectorielle.
 *
 * Chrome n'affiche l'invite d'installation que si le manifeste déclare au moins une icône
 * 192×192 et une 512×512 en PNG. Un `favicon.ico` de 48 px ne suffit pas — c'était la
 * première des deux raisons pour lesquelles la bannière n'apparaissait jamais.
 *
 * Script à lancer à la main (`node scripts/generate-icons.mjs`), pas à chaque build : les
 * icônes sont commitées. Régénérer une image identique à chaque déploiement ferait grossir
 * l'historique sans rien apporter.
 */

// Fiole d'alchimiste : le registre visuel de la spine, « un plan de travail » plutôt qu'un
// tableau de scores. Dessinée en SVG pour rester nette à toutes les tailles.
const flask = (size, pad) => {
  const s = size;
  const inner = s - pad * 2;
  const u = (v) => pad + (v / 100) * inner;

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="#171310"/>
  <g stroke="#C98A3C" stroke-width="${inner * 0.055}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M ${u(40)} ${u(14)} L ${u(40)} ${u(42)} L ${u(20)} ${u(76)}
             Q ${u(16)} ${u(86)} ${u(28)} ${u(86)}
             L ${u(72)} ${u(86)}
             Q ${u(84)} ${u(86)} ${u(80)} ${u(76)}
             L ${u(60)} ${u(42)} L ${u(60)} ${u(14)} Z"/>
    <path d="M ${u(34)} ${u(14)} L ${u(66)} ${u(14)}"/>
  </g>
  <path d="M ${u(27)} ${u(62)} L ${u(73)} ${u(62)}
           L ${u(80)} ${u(76)} Q ${u(84)} ${u(86)} ${u(72)} ${u(86)}
           L ${u(28)} ${u(86)} Q ${u(16)} ${u(86)} ${u(20)} ${u(76)} Z"
        fill="#86B79A" opacity="0.9"/>
</svg>`);
};

await mkdir("public/icons", { recursive: true });

for (const size of [192, 512]) {
  // Icône standard : le dessin occupe presque tout le carré.
  await sharp(flask(size, size * 0.12))
    .png()
    .toFile(`public/icons/icone-${size}.png`);

  /*
   * Variante « maskable » : Android recadre les icônes en cercle, en goutte ou en carré
   * arrondi selon le lanceur. Sans marge, la fiole serait rognée sur les bords. La zone
   * sûre recommandée est un cercle de 80 % — d'où un rembourrage plus généreux.
   */
  await sharp(flask(size, size * 0.24))
    .png()
    .toFile(`public/icons/icone-maskable-${size}.png`);
}

// Le manifeste est écrit ici pour que la liste des icônes ne puisse pas diverger des
// fichiers réellement produits.
const manifest = {
  name: "jvcritiqué",
  short_name: "jvcritiqué",
  description: "Les avis de jeux de tes potes, notés selon TES critères.",
  lang: "fr",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#171310",
  theme_color: "#171310",
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

console.log("4 icônes + manifeste écrits dans public/");
