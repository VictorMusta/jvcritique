import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applique les migrations, en DISANT ce qui se passe.
 *
 * Remplace `drizzle-kit migrate`, qui meurt en code 1 sans le moindre message quand la
 * connexion échoue. Constaté en vrai : le premier déploiement s'est arrêté sur
 * « Using 'postgres' driver for database querying » puis plus rien, et il a fallu deviner.
 * Une étape critique qui échoue sans expliquer pourquoi est un défaut, pas une fatalité.
 *
 * Écrit en JavaScript et non en TypeScript, volontairement : pas de transpilation, pas de
 * drapeau expérimental, pas de dépendance d'outillage. Vingt lignes où les types
 * n'apporteraient rien, et un script de migration doit être la chose la plus difficile à
 * casser du projet.
 *
 * Utilisé à l'identique en local, en CI et en production — un chemin unique, donc pas de
 * surprise réservée au serveur.
 */

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("ÉCHEC : DATABASE_URL n'est pas défini.");
  process.exit(1);
}

/**
 * Rend l'URL affichable sans divulguer le mot de passe.
 *
 * Nécessaire pour diagnostiquer : savoir vers quel hôte, quel port et quelle base on a
 * tenté de se connecter résout la moitié des pannes. Le mot de passe, lui, n'aide en rien
 * et ne doit pas se retrouver dans le journal d'un workflow public.
 */
function describe(raw) {
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.username}:***@${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(URL non analysable — vérifier les caractères spéciaux du mot de passe)";
  }
}

console.log(`Connexion à ${describe(url)}`);

const sql = postgres(url, { max: 1, onnotice: () => undefined });

try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("Migrations appliquées.");
} catch (error) {
  console.error("ÉCHEC DE LA MIGRATION");

  /**
   * Le code réel se trouve sur `error.cause`, pas sur `error`.
   *
   * `migrate()` de Drizzle enveloppe l'erreur de connexion dans une `Error` générique dont
   * le message est ACTIVEMENT TROMPEUR : `Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"`
   * alors que la cause est un mot de passe refusé. Sans déballer la cause, on cherche un
   * problème de permissions de schéma qui n'existe pas.
   *
   * Vérifié à la main sur les trois pannes : la première version de ce script lisait
   * `error.code` et n'affichait donc jamais aucun diagnostic.
   */
  const cause = error?.cause;
  const code = error?.code ?? cause?.code;

  console.error(`  cause : ${cause?.message ?? error?.message ?? error}`);
  if (code) {
    console.error(`  code  : ${code}`);
  }

  if (code === "28P01") {
    console.error(
      "\n→ Mot de passe refusé. DATABASE_URL et POSTGRES_PASSWORD doivent porter la MÊME valeur.",
    );
  } else if (code === "3D000") {
    console.error(
      "\n→ Base inexistante. Le nom après le dernier / doit correspondre à POSTGRES_DB.",
    );
  } else if (code === "ENOTFOUND" || code === "ECONNREFUSED") {
    // L'erreur arrive dans les deux sens, donc le message doit couvrir les deux : `db` ne
    // résout que depuis le réseau Compose, `localhost` ne joint la base que depuis l'hôte.
    console.error(
      "\n→ Hôte injoignable. Dans un conteneur, l'hôte est `db` (le nom du service Compose)." +
        "\n  Depuis la machine, c'est `localhost` sur le port publié.",
    );
  }

  process.exit(1);
} finally {
  await sql.end();
}
