"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "~/server/auth";
import { isAdmin } from "~/server/auth/is-admin";
import { notifier } from "~/server/db/queries/notifications";
import { addComment, deleteComment } from "~/server/db/queries/comments";
import { fail, guard, ok, type Result } from "~/server/result";

/**
 * Commentaires sous un Avis.
 *
 * La borne de 2000 caractères est délibérément basse par rapport aux 5000 des champs
 * argumentés : un commentaire est une réponse, pas un second avis. Qui a plus à dire écrit
 * le sien — c'est justement ce que le produit sait faire.
 */
const commentInputSchema = z.string().trim().min(1).max(2000);

export async function addCommentAction(
  reviewId: string,
  body: unknown,
): Promise<Result<null>> {
  const session = await auth();

  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }

  const authorId = session.user.id;

  return guard(async () => {
    const parsed = commentInputSchema.safeParse(body);

    if (!parsed.success) {
      return fail("VALIDATION_FAILED");
    }

    const done = await addComment(reviewId, authorId, parsed.data);

    if (!done) {
      // L'avis n'existe pas, ou il est privé et n'est pas le sien. On ne distingue pas :
      // le dire renseignerait un tiers sur ce qui existe.
      return fail("NOT_AUTHORIZED");
    }

    // Après l'écriture, jamais avant : notifier un commentaire qui n'existe pas mènerait
    // le destinataire vers une page où il ne trouverait rien.
    await notifier({ reviewId, actorId: authorId, kind: "comment" });

    revalidatePath(`/review/${reviewId}`);

    return ok(null);
  });
}

/**
 * Supprime un commentaire — son auteur, ou un administrateur.
 *
 * C'est ici que la modération devient nécessaire : ouvrir les commentaires crée une surface
 * où quelqu'un peut écrire ce qu'il regrette, ou ce que les autres regrettent.
 */
export async function deleteCommentAction(
  commentId: string,
  reviewId: string,
): Promise<Result<null>> {
  const session = await auth();

  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }

  const userId = session.user.id;

  return guard(async () => {
    const done = await deleteComment(commentId, userId, await isAdmin(userId));

    if (!done) {
      return fail("NOT_AUTHORIZED");
    }

    revalidatePath(`/review/${reviewId}`);

    return ok(null);
  });
}
