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

    /**
     * Avis privé — FR-17. Public par défaut.
     *
     * Avancée avant l'heure : la V0 rend les avis lisibles sans compte, et livrer ça sans
     * moyen de rendre un avis privé serait pire que le problème d'origine. Passer un avis en
     * privé invalide immédiatement l'accès par son URL — il n'y a pas de cache à purger,
     * puisqu'il n'y a pas de cache (D3).
     */
    isPrivate: d.boolean().notNull().default(false),

    /**
     * Date d'annonce dans le salon Discord, ou `null` si jamais annoncé.
     *
     * Marqueur d'IDEMPOTENCE, et c'est sa seule raison d'être. Sans lui, relancer le
     * rattrapage republierait tout — et un message Discord ne se reprend pas : cinq personnes
     * l'ont déjà lu. Une colonne vaut mieux qu'une consigne de ne cliquer qu'une fois.
     */
    announcedAt: d.timestamp({ mode: "date", withTimezone: true }),

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
  updateNotes: many(reviewUpdateNotes),
  reactions: many(reviewReactions),
  screenshots: many(reviewScreenshots),
  comments: many(reviewComments),
}));

// =================================================================================
// Screenshots — FR-8
// =================================================================================

/**
 * Une image jointe à un Avis.
 *
 * `storageKey` est un identifiant opaque, pas un chemin : le fichier vit sur un volume, et
 * la base ne doit rien savoir de son emplacement. Déplacer le stockage un jour ne demandera
 * aucune migration.
 *
 * Les dimensions sont conservées APRÈS réencodage. Elles servent à réserver la place dans la
 * page avant que l'image arrive, ce qui évite que le texte saute sous les doigts pendant le
 * chargement — sur un fil, c'est la différence entre lisible et pénible.
 *
 * Aucune limite au nombre d'images par Avis (décision du PRD), donc pas de contrainte de
 * cardinalité ici. `position` fixe l'ordre voulu par l'auteur.
 */
export const reviewScreenshots = createTable(
  "review_screenshot",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    reviewId: d
      .uuid()
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    storageKey: d.varchar({ length: 128 }).notNull().unique(),
    width: d.integer().notNull(),
    height: d.integer().notNull(),
    position: d.smallint().notNull().default(0),
    createdAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [
    index("review_screenshot_review_id_idx").on(t.reviewId),
    check(
      "review_screenshot_dimensions_positive",
      sql`${t.width} > 0 and ${t.height} > 0`,
    ),
  ],
);

export const reviewScreenshotsRelations = relations(
  reviewScreenshots,
  ({ one }) => ({
    review: one(reviews, {
      fields: [reviewScreenshots.reviewId],
      references: [reviews.id],
    }),
  }),
);

// =================================================================================
// Réactions — hors PRD, ajoutées le 8 août 2026
// =================================================================================

/**
 * Les trois réactions possibles.
 *
 * `tempting` n'est pas une de plus : c'est LA mesure du succès du produit. jvcritiqué est
 * né d'un échec précis — ne pas réussir à convaincre cinq amis de jouer à Valheim. Un pote
 * qui lit un avis et coche « ça me tente », c'est exactement ce que l'application est censée
 * provoquer, et rien d'autre dans le schéma ne l'enregistrait.
 */
export const reactionKindEnum = pgEnum("jvcritique_reaction_kind", [
  "tempting",
  "sameHere",
  "disagree",
]);

/**
 * Une réaction par personne et par avis — et surtout, PAS un fil de commentaires.
 *
 * Le PRD déclare en non-objectif « ce n'est pas un réseau social : pas de commentaires sous
 * les avis d'autrui ». Victor a voulu rouvrir le sujet ; on a retenu les réactions plutôt
 * que les commentaires, ce qui donne le signal social sans créer de surface de modération,
 * sans appeler de notifications, et sans déplacer le centre de gravité du produit vers la
 * discussion — qui a déjà lieu sur leur Discord.
 *
 * La clé primaire `(reviewId, userId)` porte la règle « une seule réaction par personne » :
 * changer d'avis remplace la ligne, il n'y a pas d'historique à gérer. C'est la BASE qui
 * l'interdit, pas une vérification applicative qu'on peut oublier.
 */
export const reviewReactions = createTable(
  "review_reaction",
  (d) => ({
    reviewId: d
      .uuid()
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: reactionKindEnum().notNull(),
    createdAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [
    primaryKey({ columns: [t.reviewId, t.userId] }),
    index("review_reaction_review_id_idx").on(t.reviewId),
  ],
);

export const reviewReactionsRelations = relations(reviewReactions, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewReactions.reviewId],
    references: [reviews.id],
  }),
  user: one(users, { fields: [reviewReactions.userId], references: [users.id] }),
}));

// =================================================================================
// Commentaires — hors PRD, ajoutés le 9 août 2026
// =================================================================================

/**
 * Un commentaire sous un Avis.
 *
 * Le PRD déclarait en non-objectif « pas de commentaires sous les avis d'autrui ». Victor a
 * d'abord retenu de simples réactions, les a essayées, puis a demandé un vrai fil : « pas
 * juste cliquer sur un bouton ». Décision prise en connaissance des conséquences — c'est
 * elle qui crée la surface de modération que la suppression administrateur devra couvrir.
 *
 * À distinguer de la Note de mise à jour (FR-10), qui reste réservée à l'auteur de l'Avis :
 * l'une prolonge l'avis, l'autre y répond. Deux tables, deux règles de propriété.
 */
export const reviewComments = createTable(
  "review_comment",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    reviewId: d
      .uuid()
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    authorId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: d.text().notNull(),
    createdAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: d.timestamp({ mode: "date", withTimezone: true }),
  }),
  (t) => [
    index("review_comment_review_id_idx").on(t.reviewId),
    // « Contient au moins un caractère non blanc », et pas `length(trim(...)) > 0` : le
    // `trim` de PostgreSQL ne retire que les espaces, ni les tabulations ni les sauts de
    // ligne. Défaut déjà rencontré sur les notes de mise à jour.
    check("review_comment_body_not_blank", sql`${t.body} ~ '[^[:space:]]'`),
  ],
);

export const reviewCommentsRelations = relations(reviewComments, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewComments.reviewId],
    references: [reviews.id],
  }),
  author: one(users, {
    fields: [reviewComments.authorId],
    references: [users.id],
  }),
}));

// =================================================================================
// Notes de mise à jour — FR-10
// =================================================================================

/**
 * Une Note de mise à jour datée, ajoutée sans toucher au corps d'origine.
 *
 * Table à part et non un champ texte de plus sur l'avis : FR-10 les veut multiples,
 * datées, et lues à la suite. Un champ unique obligerait l'auteur à écraser sa mise à jour
 * précédente — l'inverse de l'usage visé, qui est de laisser une trace de l'évolution de
 * son avis après une mise à jour du jeu.
 *
 * Il n'y a PAS de colonne auteur : seul l'auteur de l'avis peut en ajouter (FR-10), donc
 * l'auteur est celui de l'avis parent. Une colonne séparée autoriserait structurellement
 * un tiers à en écrire une, et ce n'est pas un fil de commentaires.
 */
export const reviewUpdateNotes = createTable(
  "review_update_note",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    reviewId: d
      .uuid()
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    body: d.text().notNull(),
    createdAt: d
      .timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  }),
  (t) => [
    index("review_update_note_review_id_idx").on(t.reviewId),
    /**
     * Une note vide n'a aucun sens : elle s'afficherait comme une section datée sans
     * contenu.
     *
     * Formulé « contient au moins un caractère non blanc » et non `length(trim(...)) > 0`.
     * Le `trim` de PostgreSQL ne retire **que les espaces** — pas les tabulations, pas les
     * sauts de ligne. Un corps fait de `"   \n  "` survivait donc au trim sous la forme
     * `"\n"`, de longueur 1, et passait la contrainte. Trouvé par un test d'intégration,
     * invisible autrement.
     */
    check("review_update_note_body_not_blank", sql`${t.body} ~ '[^[:space:]]'`),
  ],
);

export const reviewUpdateNotesRelations = relations(
  reviewUpdateNotes,
  ({ one }) => ({
    review: one(reviews, {
      fields: [reviewUpdateNotes.reviewId],
      references: [reviews.id],
    }),
  }),
);

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
