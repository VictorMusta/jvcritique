import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Même alias que `paths` dans tsconfig.json. Déclaré à la main plutôt qu'avec
      // `vite-tsconfig-paths` : une seule entrée, contre une dépendance de plus dans un
      // projet dont le graphe est déjà surveillé de près.
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Les tests sont COLOCALISÉS avec le code qu'ils vérifient, pas rassemblés dans un
    // dossier miroir : un fichier sans voisin de test se remarque en ouvrant le dossier.
    include: ["src/**/*.test.ts"],
    // `tests/db/` et `tests/e2e/` demandent une base et un navigateur. Ils ne tournent
    // pas ici, et surtout pas à chaque poussée.
    exclude: ["node_modules", ".next", "tests/**"],
  },
});
