"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "~/server/auth";
import { addUpdateNote, updateReview } from "~/server/db/queries/reviews";
import { fail, guard, ok, type Result } from "~/server/result";
import { reviewInputSchema } from "~/server/validation/review";

/**
 * Modifie un Avis — FR-9.
 *
 * La propriété est vérifiée à DEUX endroits : ici par la session, et dans la requête par une
 * clause `where` sur l'auteur. Ce n'est pas de la redondance décorative — l'identifiant de
 * l'avis arrive du client, donc rien n'empêche quelqu'un d'appeler cette action avec
 * l'identifiant de l'avis d'un autre. La seconde garde rend la tentative inopérante même si
 * la première était mal écrite.
 */
export async function updateReviewAction(
  reviewId: string,
  input: unknown,
): Promise<Result<{ reviewId: string }>> {
  const session = await auth();

  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }

  const authorId = session.user.id;

  return guard(async () => {
    const parsed = reviewInputSchema.safeParse(input);

    if (!parsed.success) {
      return fail("VALIDATION_FAILED");
    }

    const data = parsed.data;

    const done = await updateReview(reviewId, authorId, {
      isPrivate: data.isPrivate,
      overallScoreManual: data.overallScoreManual,
      playtimeHours: data.playtimeHours,
      completed: data.completed,
      whyRecommend: data.whyRecommend,
      whatMissed: data.whatMissed,
      whatHated: data.whatHated,
      whyNotRecommend: data.whyNotRecommend,
      domainScores: data.domainScores,
    });

    if (!done) {
      // L'avis n'existe pas, ou n'est pas le sien. On ne distingue pas les deux : le dire
      // révélerait à un tiers qu'un avis existe à cet identifiant.
      return fail("NOT_AUTHORIZED");
    }

    revalidatePath("/");
    revalidatePath(`/review/${reviewId}`);
    revalidatePath("/profile");

    return ok({ reviewId });
  });
}

/**
 * Note de mise à jour — FR-10. Ne touche ni le corps de l'avis ni ses notes chiffrées.
 */
const updateNoteSchema = z.string().trim().min(1).max(5000);

export async function addUpdateNoteAction(
  reviewId: string,
  body: unknown,
): Promise<Result<null>> {
  const session = await auth();

  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }

  const authorId = session.user.id;

  return guard(async () => {
    const parsed = updateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return fail("VALIDATION_FAILED");
    }

    // Seul l'auteur de l'avis peut en ajouter (FR-10) : ce n'est pas un fil de commentaires.
    const done = await addUpdateNote(reviewId, authorId, parsed.data);

    if (!done) {
      return fail("NOT_AUTHORIZED");
    }

    revalidatePath(`/review/${reviewId}`);
    revalidatePath("/");

    return ok(null);
  });
}
