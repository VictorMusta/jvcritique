/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Sortie autonome : le build produit un `server.js` avec seulement les dépendances
  // réellement atteintes. C'est ce qui permet une image Docker finale sans
  // node_modules complet ni gestionnaire de paquets.
  output: "standalone",
};

export default config;
