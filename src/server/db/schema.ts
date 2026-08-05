import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTableCreator,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
// `import type` et non `import { type … }` : next-auth n'expose `./adapters` qu'avec une
// condition `types`, sans entrée d'exécution. La seconde forme laisse un spécificateur de
// module à résoudre au bundler, qui échoue ; la première est effacée à la compilation.
import type { AdapterAccount } from "next-auth/adapters";

import { DOMAIN_KEYS } from "~/domain/types";

/**
 * Préfixe de projet sur toutes les tables. Hérité du gabarit et conservé : il rend
 * l'inventaire lisible et permet à `tablesFilter` de la configuration drizzle de ne
 * jamais toucher à autre chose.
 */
export const createTable = pgTableCreator((name) => `jvcritique_${name}`);

/**
 * Les sept Domaines, en type énuméré PostgreSQL.
 *
 * Dérivé de `DOMAIN_KEYS` du domaine, et non recopié : une liste écrite deux fois finit
 * par diverger. La base refusera donc toute valeur absente du glossaire — la garantie est
 * dans le moteur de stockage, pas dans une validation qu'on peut oublier d'appeler.
 */
export const domainEnum = pgEnum("jvcritique_domain", DOMAIN_KEYS);

// =================================================================================
// Authentification — tables de l'adaptateur Auth.js
// =================================================================================

export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({ mode: "date", withTimezone: true })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
  /**
   * Bannissement (FR-26). Distinct de la suppression d'un Avis (FR-27) : bannir un
   * compte et retirer un contenu sont deux gestes séparés — décision explicite de
   * Victor contre des options qui les couplaient.
   *
   * Reporté après la V0, mais la colonne existe : l'ajouter plus tard imposerait une
   * migration sur une table vivante, alors qu'elle ne coûte rien maintenant.
   */
  bannedAt: d.timestamp({ mode: "date", withTimezone: true }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  reviews: many(reviews),
  weightings: many(weightings),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// =================================================================================
// Pondération — FR-2
// =================================================================================

/**
 * Une ligne par Domaine pondéré, et non sept colonnes.
 *
 * Sept colonnes obligeraient à une migration pour ajouter un huitième Domaine, et
 * rendraient toute agrégation pénible. Une ligne absente vaut « pas encore réglé », ce
 * qui laisse `computeScore` retomber sur la moyenne simple sans traitement particulier.
 */
export const weightings = createTable(
  "weighting",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: domainEnum().notNull(),
    weight: d.smallint().notNull(),
  }),
  (t) => [
    primaryKey({ columns: [t.userId, t.domain] }),
    // L'importance va de 0 à 100 (FR-2). Contrainte portée par la BASE : une valeur hors
    // bornes est refusée même si le code oublie de valider.
    check("weighting_weight_range", sql`${t.weight} between 0 and 100`),
  ],
);

export const weightingsRelations = relations(weightings, ({ one }) => ({
  user: one(users, { fields: [weightings.userId], references: [users.id] }),
}));

// =================================================================================
// Catalogue de jeux — FR-11
// =================================================================================

export const games = createTable(
  "game",
  (d) => ({
    id: d
      .uuid()
      .primaryKey()
      .defaultRandom(),
    title: d.varchar({ length: 255 }).notNull(),
    /**
     * Lien Steam conservé brut. L'enrichissement automatique (FR-12) est reporté après
     * la V0 ; la colonne accueille dès maintenant ce que l'utilisateur colle.
     */
    steamUrl: d.varchar({ length: 2048 }),
    createdAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [
    // Unicité sur le titre NORMALISÉ : sans `lower()`, « Valheim » et « valheim »
    // créeraient deux fiches, et le catalogue se dédoublerait dès la première semaine.
    uniqueIndex("game_title_lower_idx").on(sql`lower(${t.title})`),
  ],
);

export const gamesRelations = relations(games, ({ many }) => ({
  reviews: many(reviews),
}));

// =================================================================================
// Avis — FR-3, FR-4, FR-5, FR-22
// =================================================================================

export const reviews = createTable(
  "review",
  (d) => ({
    // UUID et non un entier séquentiel : l'identifiant apparaît dans l'URL publique
    // (FR-16), et une séquence divulguerait le nombre d'avis du site.
    id: d
      .uuid()
      .primaryKey()
      .defaultRandom(),
    gameId: d
      .uuid()
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    authorId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * Note globale SAISIE À LA MAIN, ou `null` si l'auteur a choisi le mode calculé
     * (FR-5).
     *
     * La valeur calculée n'est délibérément PAS stockée. D3 impose le recalcul à la
     * lecture, et R-D3 insiste : une pondération modifiée ne doit pas laisser de pages
     * figées avec les anciennes notes. Stocker le calcul créerait exactement cette
     * donnée périmée. Le mode d'obtention se déduit donc de cette colonne — non nulle
     * signifie « saisie », nulle signifie « calculée » — ce qui supprime au passage
     * toute possibilité d'incohérence entre une valeur et son étiquette.
     *
     * La saisie manuelle est un entier (FR-5) ; l'arrondi à une décimale ne concerne que
     * la valeur calculée.
     */
    overallScoreManual: d.smallint(),

    /** Temps de jeu en heures, entier, sans borne haute (FR-22). */
    playtimeHours: d.integer(),
    /** Jeu terminé — indépendant du temps de jeu : 40 h sans finir, 6 h et fini. */
    completed: d.boolean().notNull().default(false),

    // Les quatre champs argumentés (FR-4), tous facultatifs et indépendants.
    whyRecommend: d.text(),
    whatMissed: d.text(),
    whatHated: d.text(),
    whyNotRecommend: d.text(),

    createdAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdate(() => new Date()),
  }),
  (t) => [
    // Un seul Avis par personne et par Jeu : une mise à jour est une modification
    // (FR-9) ou une Note de mise à jour (FR-10), jamais un second Avis.
    uniqueIndex("review_author_game_idx").on(t.authorId, t.gameId),
    // Le Fil est chronologique décroissant (FR-14).
    index("review_created_at_idx").on(t.createdAt),
    index("review_game_id_idx").on(t.gameId),
    check(
      "review_overall_score_range",
      sql`${t.overallScoreManual} is null or ${t.overallScoreManual} between 0 and 20`,
    ),
    check(
      "review_playtime_non_negative",
      sql`${t.playtimeHours} is null or ${t.playtimeHours} >= 0`,
    ),
  ],
);

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  game: one(games, { fields: [reviews.gameId], references: [games.id] }),
  author: one(users, { fields: [reviews.authorId], references: [users.id] }),
  domainScores: many(reviewDomainScores),
}));

// =================================================================================
// Notes de domaine — D1 : table fille + CHECK
// =================================================================================

/**
 * Une ligne par Domaine RENSEIGNÉ, et la contrainte est le cœur du sujet.
 *
 * Les trois états d'une Note de domaine sont représentés ainsi :
 *
 * | État            | Représentation                                |
 * |-----------------|-----------------------------------------------|
 * | noté (0 à 20)   | ligne présente, `value` non nul, `notApplicable` faux |
 * | pas évaluable   | ligne présente, `value` nul, `notApplicable` vrai     |
 * | vide            | **aucune ligne**                              |
 *
 * `vide` par absence de ligne, et non par une ligne à null : c'est ce qui aligne le
 * stockage sur `computeScore`, qui traite déjà un Domaine absent comme vide. Une seule
 * notion de vide, un seul comportement.
 *
 * Le CHECK rend les combinaisons absurdes IMPOSSIBLES AU NIVEAU DE LA BASE — une note
 * accompagnée de « pas évaluable », ou une ligne qui ne dirait rien du tout. C'est une
 * garantie qu'aucun oubli de validation applicative ne peut contourner, et elle se
 * vérifie par un test d'intégration qui tente l'insertion interdite.
 */
export const reviewDomainScores = createTable(
  "review_domain_score",
  (d) => ({
    reviewId: d
      .uuid()
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    domain: domainEnum().notNull(),
    value: d.smallint(),
    notApplicable: d.boolean().notNull().default(false),
  }),
  (t) => [
    primaryKey({ columns: [t.reviewId, t.domain] }),
    /**
     * Le `IS NOT NULL` de la seconde clause n'est PAS redondant, et son absence a
     * réellement laissé passer une ligne vide en test.
     *
     * Une contrainte `CHECK` de PostgreSQL ne rejette une ligne que si son expression
     * vaut `FALSE`. Si elle vaut `NULL`, la ligne est **acceptée**. Avec
     * `notApplicable = false` et `value = NULL`, la seconde clause s'évaluait en
     * `true AND (NULL BETWEEN 0 AND 20)` → `NULL`, et `false OR NULL` → `NULL` : une
     * ligne qui n'affirme ni note ni « pas évaluable » entrait en base.
     *
     * Défaut invisible au typage et aux tests unitaires. Il ne se voit qu'en insérant
     * pour de vrai.
     */
    check(
      "review_domain_score_exclusive",
      sql`(${t.notApplicable} = true and ${t.value} is null)
       or (${t.notApplicable} = false and ${t.value} is not null and ${t.value} between 0 and 20)`,
    ),
  ],
);

export const reviewDomainScoresRelations = relations(
  reviewDomainScores,
  ({ one }) => ({
    review: one(reviews, {
      fields: [reviewDomainScores.reviewId],
      references: [reviews.id],
    }),
  }),
);
