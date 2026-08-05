import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuration des tests d'INTÉGRATION — séparée de `vitest.config.ts` volontairement.
 *
 * Ils exigent un PostgreSQL migré, donc ils ne doivent pas se déclencher avec `npm test`
 * ni bloquer un développeur qui n'a pas Docker en route. Les mélanger rendrait la suite
 * unitaire dépendante d'une infrastructure, et une suite unitaire qui peut échouer pour
 * une raison d'environnement cesse d'être un signal fiable.
 */
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    // Une seule connexion partagée et des fixtures préfixées par exécution : le
    // parallélisme sur une base unique produirait des échecs qui n'apprennent rien.
    fileParallelism: false,
  },
});
