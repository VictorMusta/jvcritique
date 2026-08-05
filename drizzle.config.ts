import { type Config } from "drizzle-kit";

// Volontairement `process.env` et non `~/env`.
//
// Ce fichier est lu par drizzle-kit, en dehors du graphe de modules de l'application.
// Passer par le schéma Zod de `~/env` aurait deux conséquences fâcheuses : il faudrait
// embarquer l'alias de chemins `~` dans le conteneur de migration, et ce conteneur
// exigerait alors TOUTES les variables de l'application — y compris les identifiants
// Discord — alors qu'il n'a besoin que de l'URL de la base.
//
// Moins de secrets dans un conteneur qui n'en a pas l'usage.
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL est requis pour exécuter drizzle-kit (génération ou migration).",
  );
}

export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  tablesFilter: ["jvcritique_*"],
} satisfies Config;
