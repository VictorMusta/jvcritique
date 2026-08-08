"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "~/server/auth";
import { removeReaction, setReaction } from "~/server/db/queries/reactions";
import { fail, guard, ok, type Result } from "~/server/result";

/**
 * Pose, remplace ou retire une réaction sur un Avis.
 *
 * `null` retire la réaction : un seul point d'entrée plutôt que deux actions symétriques.
 * Le geste utilisateur est le même — on touche le bouton qui est déjà actif pour l'annuler —
 * et deux actions séparées se seraient désynchronisées à la première évolution.
 */
const reactionInputSchema = z
  .enum(["tempting", "sameHere", "disagree"])
  .nullable();

export async function reactAction(
  reviewId: string,
  kind: unknown,
): Promise<Result<null>> {
  const session = await auth();

  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }

  const userId = session.user.id;

  return guard(async () => {
    const parsed = reactionInputSchema.safeParse(kind);

    if (!parsed.success) {
      return fail("VALIDATION_FAILED");
    }

    if (parsed.data === null) {
      await removeReaction(reviewId, userId);
    } else {
      const done = await setReaction(reviewId, userId, parsed.data);

      if (!done) {
        // L'avis n'existe pas, ou c'est le sien. On ne distingue pas : dire « c'est ton
        // propre avis » n'apprendrait rien à quelqu'un qui l'aurait deviné, et dire « il
        // n'existe pas » renseignerait un tiers sur ce qui existe.
        return fail("NOT_AUTHORIZED");
      }
    }

    // Invalidation route par route (INV-2, R-D3).
    revalidatePath("/");
    revalidatePath(`/review/${reviewId}`);

    return ok(null);
  });
}
