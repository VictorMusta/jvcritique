import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { games, reviews, users } from "~/server/db/schema";

/**
 * Les avis publiés qui n'ont jamais été annoncés dans le salon Discord.
 *
 * `announcedAt` est un marqueur d'IDEMPOTENCE, et c'est sa seule raison d'être : sans lui,
 * relancer le rattrapage republierait tout, et un message Discord ne se reprend pas — cinq
 * personnes l'ont déjà lu. Une colonne vaut mieux qu'une consigne de ne cliquer qu'une fois.
 *
 * Les avis PRIVÉS sont exclus ici en plus de l'être à l'envoi. C'est délibérément redondant :
 * les compter les ferait apparaître dans « 7 avis en attente » alors qu'ils ne partiront
 * jamais, et le bouton mentirait sur ce qu'il va faire.
 */
export type PendingAnnouncement = {
  reviewId: string;
  gameTitle: string;
  authorName: string;
  score: number | null;
  body: string | null;
};

const enAttente = and(isNull(reviews.announcedAt), eq(reviews.isPrivate, false));

export async function countPendingAnnouncements(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(enAttente);

  return row?.n ?? 0;
}

/**
 * Le retard, du PLUS ANCIEN au plus récent.
 *
 * L'ordre n'est pas cosmétique : le salon doit se lire comme l'histoire s'est déroulée. Les
 * publier à l'envers donnerait une chronologie fausse, définitivement, dans un fil que
 * personne ne réordonnera.
 */
export async function getPendingAnnouncements(
  limit: number,
): Promise<PendingAnnouncement[]> {
  return db
    .select({
      reviewId: reviews.id,
      gameTitle: games.title,
      authorName: users.name,
      score: reviews.overallScoreManual,
      body: reviews.whyRecommend,
    })
    .from(reviews)
    .innerJoin(games, eq(games.id, reviews.gameId))
    .innerJoin(users, eq(users.id, reviews.authorId))
    .where(enAttente)
    .orderBy(asc(reviews.createdAt))
    .limit(limit)
    .then((lignes) =>
      lignes.map((l) => ({ ...l, authorName: l.authorName ?? "Quelqu'un" })),
    );
}

/**
 * Marque un avis comme annoncé.
 *
 * Appelé UNIQUEMENT après un envoi réellement accepté par Discord. Marquer avant l'envoi
 * perdrait silencieusement les avis dont l'annonce a échoué : ils seraient réputés annoncés
 * sans que personne ne les ait vus, et aucun rattrapage ultérieur ne les retrouverait.
 */
export async function markAnnounced(reviewId: string): Promise<void> {
  await db
    .update(reviews)
    .set({ announcedAt: new Date() })
    .where(eq(reviews.id, reviewId));
}
