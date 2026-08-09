import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_DISCORD_ID: z.string(),
    AUTH_DISCORD_SECRET: z.string(),
    // Lue ici pour composer les liens des annonces quand `APP_URL` est absente.
    AUTH_URL: z.string().url().optional(),
    DATABASE_URL: z.string().url(),
    /**
     * Identifiants DISCORD des administrateurs, séparés par des virgules.
     *
     * Des identifiants Discord et non les identifiants internes des comptes : ce sont les
     * seuls que Victor peut lire lui-même (clic droit sur un profil, « Copier l'identifiant »),
     * et ils survivent à une recréation de la ligne utilisateur. L'architecture pose déjà que
     * l'identité Discord est une clé externe rattachable, jamais l'identifiant du compte.
     *
     * Dans une variable d'environnement et non en base (D4) : personne ne peut se
     * promouvoir administrateur depuis l'application, même en cas de faille, puisque la
     * source de vérité vit sur le serveur et exige un redéploiement pour changer.
     *
     * Facultative : sans elle, il n'y a simplement aucun administrateur.
     */
    ADMIN_DISCORD_IDS: z.string().optional(),

    /**
     * Webhook du salon Discord où annoncer les nouveaux avis.
     *
     * Facultatif : sans lui, aucune annonce n'est envoyée, et c'est un état valide. Le
     * webhook est un SECRET — quiconque le détient peut écrire dans le salon.
     */
    DISCORD_WEBHOOK_URL: z.string().url().optional(),

    /**
     * Adresse publique du site, pour composer les liens des annonces.
     *
     * Facultative : à défaut, elle se déduit d'`AUTH_URL`, qui vaut « …/api/auth » par
     * convention. La déclarer explicitement évite de dépendre de cette convention.
     */
    APP_URL: z.string().url().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    ADMIN_DISCORD_IDS: process.env.ADMIN_DISCORD_IDS,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
    APP_URL: process.env.APP_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
