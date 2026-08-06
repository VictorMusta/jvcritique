import { and, desc, eq, inArray, or, type SQL } from "drizzle-orm";

import type { DomainKey, DomainScores, Weighting } from "~/domain/types";
import { db } from "../index";
import {
  reviewDomainScores,
  reviewUpdateNotes,
  reviews,
  weightings,
} from "../schema";

/**
 * FRONTIÈRE 2 — seul endroit qui parle à la base.
 */

/** Ligne de Note de domaine telle qu'elle sort de la base. */
type DomainScoreRow = {
  domain: DomainKey;
  value: number | null;
  notApplicable: boolean;
};

/**
 * Traduit les lignes de la base vers la forme attendue par le moteur de notation.
 *
 * Une ligne `notApplicable` devient `notApplicable`, une ligne avec valeur devient `rated`,
 * et un Domaine sans ligne reste simplement absent — ce que `computeScore` traite déjà comme
 * vide. Aucun cas particulier à écrire : la représentation en base a été choisie pour que
 * cette traduction soit triviale.
 */
function toDomainScores(rows: DomainScoreRow[]): DomainScores {
  const scores: Partial<Record<DomainKey, DomainScores[DomainKey]>> = {};

  for (const row of rows) {
    scores[row.domain] = row.notApplicable
      ? { kind: "notApplicable" }
      : { kind: "rated", value: row.value ?? 0 };
  }

  return scores;
}

export type UpdateNote = { id: string; body: string; createdAt: Date };

/**
 * Condition de visibilité — FR-17.
 *
 * Un Avis privé n'est visible que par son auteur. Appliquée DANS LA REQUÊTE et non par un
 * filtre en JavaScript après coup : une liste filtrée en mémoire dépend de la discipline de
 * chaque appelant, et le jour où quelqu'un ajoute une surface en oubliant le filtre, les avis
 * privés de ses potes se retrouvent affichés. Ici, la base ne les rend simplement pas.
 */
function visibleTo(viewerId: string | null): SQL | undefined {
  if (viewerId === null) {
    return eq(reviews.isPrivate, false);
  }

  return or(eq(reviews.isPrivate, false), eq(reviews.authorId, viewerId));
}

export type ReviewForDisplay = {
  id: string;
  createdAt: Date;
  /** Avis privé — visible de son seul auteur (FR-17). */
  isPrivate: boolean;
  /** Date de dernière modification, visible quand l'avis a été modifié (FR-9). */
  updatedAt: Date | null;
  updateNotes: UpdateNote[];
  overallScoreManual: number | null;
  playtimeHours: number | null;
  completed: boolean;
  whyRecommend: string | null;
  whatMissed: string | null;
  whatHated: string | null;
  whyNotRecommend: string | null;
  game: { id: string; title: string; steamUrl: string | null };
  author: { id: string; name: string | null; image: string | null };
  domainScores: DomainScores;
  /** Pondération de l'auteur, nécessaire pour recalculer SA note (FR-5). */
  authorWeighting: Weighting;
};

/**
 * Charge les pondérations de plusieurs Utilisateurs EN UNE REQUÊTE.
 *
 * Écrit ainsi pour la raison qu'Amelia avait soulevée pendant la revue d'architecture : une
 * page de liste doit avoir un nombre de requêtes SQL BORNÉ, indépendant du nombre d'avis
 * affichés. Charger la pondération avis par avis donnerait vingt requêtes pour vingt avis,
 * et le défaut ne se verrait qu'en production, quand le fil se remplit.
 *
 * Deux requêtes au total pour tout le fil : les avis, puis les pondérations de leurs auteurs.
 */
async function getWeightingsFor(
  userIds: string[],
): Promise<Map<string, Weighting>> {
  const byUser = new Map<string, Weighting>();

  if (userIds.length === 0) {
    return byUser;
  }

  const rows = await db
    .select({
      userId: weightings.userId,
      domain: weightings.domain,
      weight: weightings.weight,
    })
    .from(weightings)
    .where(inArray(weightings.userId, userIds));

  for (const { userId, domain, weight } of rows) {
    const existing = byUser.get(userId) ?? {};
    byUser.set(userId, { ...existing, [domain]: weight });
  }

  return byUser;
}

const reviewWith = {
  game: true,
  author: true,
  domainScores: true,
  updateNotes: true,
} as const;

type RawReview = {
  id: string;
  createdAt: Date;
  isPrivate: boolean;
  updatedAt: Date | null;
  updateNotes: UpdateNote[];
  overallScoreManual: number | null;
  playtimeHours: number | null;
  completed: boolean;
  whyRecommend: string | null;
  whatMissed: string | null;
  whatHated: string | null;
  whyNotRecommend: string | null;
  game: { id: string; title: string; steamUrl: string | null };
  author: { id: string; name: string | null; image: string | null };
  domainScores: DomainScoreRow[];
};

function assemble(
  raw: RawReview,
  weightingsByUser: Map<string, Weighting>,
): ReviewForDisplay {
  return {
    id: raw.id,
    createdAt: raw.createdAt,
    isPrivate: raw.isPrivate,
    updatedAt: raw.updatedAt,
    // Chronologique CROISSANT : FR-10 veut qu'elles « se lisent à la suite », dans l'ordre
    // où l'auteur les a écrites — l'inverse du fil.
    //
    // Trié ici plutôt que dans la requête relationnelle : la forme `orderBy` de Drizzle
    // entre en conflit avec le `as const` de `reviewWith`, et il y a au plus une poignée de
    // notes par avis. Le coût est nul, le typage reste intact.
    updateNotes: [...raw.updateNotes].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    ),
    overallScoreManual: raw.overallScoreManual,
    playtimeHours: raw.playtimeHours,
    completed: raw.completed,
    whyRecommend: raw.whyRecommend,
    whatMissed: raw.whatMissed,
    whatHated: raw.whatHated,
    whyNotRecommend: raw.whyNotRecommend,
    game: raw.game,
    author: raw.author,
    domainScores: toDomainScores(raw.domainScores),
    authorWeighting: weightingsByUser.get(raw.author.id) ?? {},
  };
}

/**
 * Le Fil — chronologique décroissant (FR-14).
 *
 * V0 : TOUS les avis de tous les utilisateurs, sans filtre de suivi. FR-14 prévoyait les
 * avis des personnes suivies, mais le suivi (FR-18) est reporté — et à cinq amis qui se
 * connaissent, un graphe de suivi n'apporterait rien à filtrer. Cela supprime au passage le
 * problème du fil vide. Le jour où FR-18 arrive, le filtre se pose par-dessus une requête
 * qui existe déjà.
 */
export async function getFeed(
  viewerId: string | null,
  limit = 20,
): Promise<ReviewForDisplay[]> {
  const rows = await db.query.reviews.findMany({
    where: visibleTo(viewerId),
    with: reviewWith,
    orderBy: [desc(reviews.createdAt)],
    limit,
  });

  const weightingsByUser = await getWeightingsFor([
    ...new Set(rows.map((r) => r.author.id)),
  ]);

  return rows.map((r) => assemble(r, weightingsByUser));
}

export async function getReviewById(
  id: string,
): Promise<ReviewForDisplay | null> {
  const raw = await db.query.reviews.findFirst({
    where: eq(reviews.id, id),
    with: reviewWith,
  });

  if (!raw) {
    return null;
  }

  const weightingsByUser = await getWeightingsFor([raw.author.id]);

  return assemble(raw, weightingsByUser);
}

/** Tous les Avis d'un Jeu (FR-14). */
export async function getReviewsByGame(
  gameId: string,
  viewerId: string | null,
): Promise<ReviewForDisplay[]> {
  const rows = await db.query.reviews.findMany({
    where: and(eq(reviews.gameId, gameId), visibleTo(viewerId)),
    with: reviewWith,
    orderBy: [desc(reviews.createdAt)],
  });

  const weightingsByUser = await getWeightingsFor([
    ...new Set(rows.map((r) => r.author.id)),
  ]);

  return rows.map((r) => assemble(r, weightingsByUser));
}

/** Avis d'un Utilisateur, pour son profil (FR-14). */
export async function getReviewsByAuthor(
  authorId: string,
  viewerId: string | null,
): Promise<ReviewForDisplay[]> {
  const rows = await db.query.reviews.findMany({
    where: and(eq(reviews.authorId, authorId), visibleTo(viewerId)),
    with: reviewWith,
    orderBy: [desc(reviews.createdAt)],
  });

  const weightingsByUser = await getWeightingsFor([authorId]);

  return rows.map((r) => assemble(r, weightingsByUser));
}

export type NewReviewDomainScore = {
  domain: DomainKey;
  value: number | null;
  notApplicable: boolean;
};

/**
 * Crée un Avis et ses Notes de domaine DANS UNE TRANSACTION.
 *
 * Sans transaction, une panne entre les deux insertions laisserait un Avis sans aucune Note
 * de domaine — donc sans note relue possible, et sans note du tout si l'auteur avait choisi
 * le mode calculé. Un déchet silencieux, visible seulement à la lecture.
 */
export async function createReview(input: {
  gameId: string;
  authorId: string;
  isPrivate: boolean;
  overallScoreManual: number | null;
  playtimeHours: number | null;
  completed: boolean;
  whyRecommend: string | null;
  whatMissed: string | null;
  whatHated: string | null;
  whyNotRecommend: string | null;
  domainScores: NewReviewDomainScore[];
}): Promise<string> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(reviews)
      .values({
        gameId: input.gameId,
        authorId: input.authorId,
        isPrivate: input.isPrivate,
        overallScoreManual: input.overallScoreManual,
        playtimeHours: input.playtimeHours,
        completed: input.completed,
        whyRecommend: input.whyRecommend,
        whatMissed: input.whatMissed,
        whatHated: input.whatHated,
        whyNotRecommend: input.whyNotRecommend,
      })
      .returning({ id: reviews.id });

    if (!created) {
      throw new Error("L'insertion de l'avis n'a rien renvoyé.");
    }

    if (input.domainScores.length > 0) {
      await tx.insert(reviewDomainScores).values(
        input.domainScores.map((score) => ({
          reviewId: created.id,
          domain: score.domain,
          value: score.value,
          notApplicable: score.notApplicable,
        })),
      );
    }

    return created.id;
  });
}

/**
 * Charge un Avis pour modification, **borné à son auteur**.
 *
 * La propriété est vérifiée DANS LA REQUÊTE, par une clause `where` sur l'auteur, et pas
 * seulement dans l'action appelante. Deux gardes valent mieux qu'une quand la seconde est
 * gratuite : si un jour quelqu'un appelle cette fonction depuis un nouvel endroit en
 * oubliant le contrôle, la requête ne rendra simplement rien.
 *
 * Rend `null` aussi bien pour « n'existe pas » que pour « n'est pas à toi ». Volontaire :
 * distinguer les deux révélerait à un tiers qu'un avis existe à cet identifiant.
 */
export type ReviewForEdit = {
  reviewId: string;
  isPrivate: boolean;
  gameTitle: string;
  steamUrl: string | null;
  overallScoreManual: number | null;
  playtimeHours: number | null;
  completed: boolean;
  whyRecommend: string | null;
  whatMissed: string | null;
  whatHated: string | null;
  whyNotRecommend: string | null;
  domainScores: DomainScores;
};

export async function getReviewForEdit(
  reviewId: string,
  authorId: string,
): Promise<ReviewForEdit | null> {
  const raw = await db.query.reviews.findFirst({
    where: and(eq(reviews.id, reviewId), eq(reviews.authorId, authorId)),
    with: { game: true, domainScores: true },
  });

  if (!raw) {
    return null;
  }

  return {
    reviewId: raw.id,
    isPrivate: raw.isPrivate,
    gameTitle: raw.game.title,
    steamUrl: raw.game.steamUrl,
    overallScoreManual: raw.overallScoreManual,
    playtimeHours: raw.playtimeHours,
    completed: raw.completed,
    whyRecommend: raw.whyRecommend,
    whatMissed: raw.whatMissed,
    whatHated: raw.whatHated,
    whyNotRecommend: raw.whyNotRecommend,
    // Converti ici plutôt que dans la page : la traduction des lignes de la base vers la
    // forme du domaine appartient à la couche qui parle à la base (frontière 2).
    domainScores: toDomainScores(raw.domainScores),
  };
}

/**
 * Remplace intégralement le contenu d'un Avis — FR-9, « modifiable intégralement ».
 *
 * Les Notes de domaine sont supprimées puis réinsérées, dans la même transaction que la
 * mise à jour de l'avis. Un `upsert` domaine par domaine laisserait vivre ceux que l'auteur
 * vient de repasser en « vide » : ils disparaîtraient du formulaire mais resteraient dans le
 * calcul, et l'auteur verrait une note qu'il ne peut plus expliquer.
 *
 * Le jeu n'est pas modifiable ici : changer le jeu d'un avis existant, c'est écrire un autre
 * avis. La contrainte d'unicité (auteur, jeu) le refuserait de toute façon.
 */
export async function updateReview(
  reviewId: string,
  authorId: string,
  input: {
    isPrivate: boolean;
    overallScoreManual: number | null;
    playtimeHours: number | null;
    completed: boolean;
    whyRecommend: string | null;
    whatMissed: string | null;
    whatHated: string | null;
    whyNotRecommend: string | null;
    domainScores: NewReviewDomainScore[];
  },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(reviews)
      .set({
        isPrivate: input.isPrivate,
        overallScoreManual: input.overallScoreManual,
        playtimeHours: input.playtimeHours,
        completed: input.completed,
        whyRecommend: input.whyRecommend,
        whatMissed: input.whatMissed,
        whatHated: input.whatHated,
        whyNotRecommend: input.whyNotRecommend,
        // `$onUpdate` du schéma renseigne `updatedAt`. Posé côté Drizzle et non par un
        // déclencheur SQL : la colonne est nullable, donc aucune intégrité n'en dépend, et
        // toutes les écritures de ce projet passent par ici.
      })
      // La propriété est de nouveau dans la clause `where` : même si l'appelant s'est
      // trompé, on ne peut pas modifier l'avis de quelqu'un d'autre.
      .where(and(eq(reviews.id, reviewId), eq(reviews.authorId, authorId)))
      .returning({ id: reviews.id });

    if (updated.length === 0) {
      return false;
    }

    await tx
      .delete(reviewDomainScores)
      .where(eq(reviewDomainScores.reviewId, reviewId));

    if (input.domainScores.length > 0) {
      await tx.insert(reviewDomainScores).values(
        input.domainScores.map((score) => ({
          reviewId,
          domain: score.domain,
          value: score.value,
          notApplicable: score.notApplicable,
        })),
      );
    }

    return true;
  });
}

/**
 * Ajoute une Note de mise à jour — FR-10.
 *
 * N'altère ni le corps de l'Avis ni ses notes chiffrées : c'est explicitement une addition.
 * L'auteur ajuste ses notes séparément s'il le souhaite.
 */
export async function addUpdateNote(
  reviewId: string,
  authorId: string,
  body: string,
): Promise<boolean> {
  // La propriété se vérifie en lisant l'avis sous contrainte d'auteur : on n'insère la note
  // que si l'avis parent est bien le sien.
  const owned = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.authorId, authorId)))
    .limit(1);

  if (!owned[0]) {
    return false;
  }

  await db.insert(reviewUpdateNotes).values({ reviewId, body });

  return true;
}
