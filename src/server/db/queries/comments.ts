import { and, asc, eq } from "drizzle-orm";

import { db } from "../index";
import { reviewComments, reviews } from "../schema";

/**
 * FRONTIÈRE 2 — seul endroit qui parle à la base.
 */

export type Comment = {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date | null;
  author: { id: string; name: string | null };
};

/**
 * Les commentaires d'un Avis, du plus ancien au plus récent.
 *
 * Ordre CROISSANT, contrairement au fil : une discussion se lit de haut en bas, dans l'ordre
 * où elle s'est tenue. L'inverser obligerait à remonter pour comprendre une réponse.
 */
export async function getComments(reviewId: string): Promise<Comment[]> {
  const rows = await db.query.reviewComments.findMany({
    where: eq(reviewComments.reviewId, reviewId),
    orderBy: [asc(reviewComments.createdAt)],
    with: { author: { columns: { id: true, name: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    author: r.author,
  }));
}

/**
 * Ajoute un commentaire.
 *
 * Rend `false` si l'Avis n'existe pas, ou s'il est privé et n'appartient pas à celui qui
 * écrit — commenter un avis qu'on n'a pas le droit de lire n'a aucun sens, et la
 * vérification ne peut pas se déléguer à l'affichage.
 */
export async function addComment(
  reviewId: string,
  authorId: string,
  body: string,
): Promise<boolean> {
  const cible = await db
    .select({ isPrivate: reviews.isPrivate, authorId: reviews.authorId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  const avis = cible[0];

  if (!avis || (avis.isPrivate && avis.authorId !== authorId)) {
    return false;
  }

  await db.insert(reviewComments).values({ reviewId, authorId, body });

  return true;
}

/**
 * Supprime un commentaire.
 *
 * `parAdministrateur` lève la contrainte de propriété : c'est la surface de modération que
 * les commentaires créent, et la raison pour laquelle le PRD donnait à l'administrateur le
 * droit de SUPPRIMER plutôt que de réécrire. Une suppression se voit ; une réécriture se
 * ferait sous le nom de son auteur.
 */
export async function deleteComment(
  commentId: string,
  userId: string,
  parAdministrateur: boolean,
): Promise<boolean> {
  const condition = parAdministrateur
    ? eq(reviewComments.id, commentId)
    : and(
        eq(reviewComments.id, commentId),
        // La propriété est dans la clause `where` et pas seulement dans l'action : si un
        // jour quelqu'un appelle cette fonction depuis un nouvel endroit en oubliant le
        // contrôle, la requête ne supprimera simplement rien.
        eq(reviewComments.authorId, userId),
      );

  const supprimes = await db
    .delete(reviewComments)
    .where(condition)
    .returning({ id: reviewComments.id });

  return supprimes.length > 0;
}
