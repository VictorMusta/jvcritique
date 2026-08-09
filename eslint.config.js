// `eslint-config-next` 16 expose une configuration à plat native. La couche de
// compatibilité `FlatCompat` du gabarit d'origine n'est plus nécessaire — et elle
// échouait sur une structure circulaire en tentant de normaliser cette config.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
// @ts-ignore -- no types for this plugin
import drizzle from "eslint-plugin-drizzle";

export default tseslint.config(
  {
    ignores: [".next", "drizzle/**"],
  },
  ...nextCoreWebVitals,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      drizzle,
    },
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // `varsIgnorePattern` en plus de `argsIgnorePattern` : la convention du préfixe `_`
      // vaut aussi pour une variable délibérément ignorée — typiquement un champ écarté par
      // déstructuration pour construire un objet sans lui.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      /*
       * Un `const` utilisé avant sa déclaration a mis la page d'un avis en 500, en
       * production, dès le premier commentaire reçu (9 août 2026).
       *
       * TypeScript ne l'attrape pas à l'intérieur d'une FERMETURE : il ne sait pas quand
       * celle-ci s'exécutera. Et la fermeture en question ne tournait que sur un tableau non
       * vide — donc jamais pendant le développement, où il n'y avait aucun commentaire.
       *
       * `functions: false` parce que les déclarations de fonction, elles, sont remontées : les
       * signaler forcerait à ranger les fonctions auxiliaires avant leur usage sans rien
       * apporter. Ce sont les variables qui ont une zone morte.
       */
      "@typescript-eslint/no-use-before-define": [
        "error",
        { functions: false, variables: true, typedefs: false, enums: true },
      ],
      "drizzle/enforce-delete-with-where": [
        "error",
        { drizzleObjectName: ["db", "ctx.db"] },
      ],
      "drizzle/enforce-update-with-where": [
        "error",
        { drizzleObjectName: ["db", "ctx.db"] },
      ],
    },
  },
  {
    /*
     * Le schéma Drizzle est exempté, et c'est légitime plutôt que commode.
     *
     * `relations()` reçoit une FONCTION, appelée bien après l'initialisation du module. Et les
     * références entre tables sont MUTUELLES par nature : un utilisateur a des avis, un avis a
     * un auteur. Aucun ordre de déclaration ne satisfait les deux — il n'existe pas de version
     * du fichier qui passe la règle.
     */
    files: ["src/server/db/schema.ts"],
    rules: { "@typescript-eslint/no-use-before-define": "off" },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
