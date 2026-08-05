import { desc, eq, inArray } from "drizzle-orm";

import type { DomainKey, DomainScores, Weighting } from "~/domain/types";
import { db } from "../index";
import { reviewDomainScores, reviews, weightings } from "../schema";

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

export type ReviewForDisplay = {
  id: string;
  createdAt: Date;
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
} as const;

type RawReview = {
  id: string;
  createdAt: Date;
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
export async function getFeed(limit = 20): Promise<ReviewForDisplay[]> {
  const rows = await db.query.reviews.findMany({
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
): Promise<ReviewForDisplay[]> {
  const rows = await db.query.reviews.findMany({
    where: eq(reviews.gameId, gameId),
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
): Promise<ReviewForDisplay[]> {
  const rows = await db.query.reviews.findMany({
    where: eq(reviews.authorId, authorId),
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
