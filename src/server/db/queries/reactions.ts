import { and, eq } from "drizzle-orm";

import { db } from "../index";
import { reviewReactions, reviews } from "../schema";

/**
 * FRONTIÈRE 2 — seul endroit qui parle à la base.
 */

export type ReactionKind = "tempting" | "sameHere" | "disagree";

/**
 * Pose ou remplace la réaction d'un Utilisateur sur un Avis.
 *
 * `onConflictDoUpdate` sur la clé primaire `(reviewId, userId)` : changer d'avis remplace la
 * ligne au lieu d'en ajouter une. Il n'y a donc jamais deux réactions d'une même personne
 * sur un même avis, et ce n'est pas une garantie applicative — c'est la clé primaire.
 *
 * Rend `false` si l'Avis n'existe pas, ou s'il appartient à celui qui réagit.
 */
export async function setReaction(
  reviewId: string,
  userId: string,
  kind: ReactionKind,
): Promise<boolean> {
  /*
   * On ne réagit pas à son propre avis.
   *
   * Vérifié ici et non par une contrainte : PostgreSQL ne sait pas exprimer « cette colonne
   * doit différer d'une colonne d'une AUTRE table » dans un CHECK, qui ne peut pas contenir
   * de sous-requête. Un déclencheur le pourrait, au prix d'une logique métier cachée dans la
   * base. Pour une règle d'ergonomie — « moi aussi » sous son propre texte n'a aucun sens —
   * la vérification applicative est proportionnée.
   */
  const target = await db
    .select({ authorId: reviews.authorId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!target[0] || target[0].authorId === userId) {
    return false;
  }

  await db
    .insert(reviewReactions)
    .values({ reviewId, userId, kind })
    .onConflictDoUpdate({
      target: [reviewReactions.reviewId, reviewReactions.userId],
      set: { kind },
    });

  return true;
}

/** Retire la réaction d'un Utilisateur. Idempotent : retirer deux fois ne casse rien. */
export async function removeReaction(
  reviewId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(reviewReactions)
    .where(
      and(
        eq(reviewReactions.reviewId, reviewId),
        eq(reviewReactions.userId, userId),
      ),
    );
}
