"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { findOrCreateGame } from "~/server/db/queries/games";
import { createReview } from "~/server/db/queries/reviews";
import { fail, guard, ok, type Result } from "~/server/result";
import { reviewInputSchema } from "~/server/validation/review";

/**
 * Publie un Avis — FR-3, FR-4, FR-5, FR-11, FR-22.
 *
 * Rend l'identifiant de l'Avis créé au lieu d'appeler `redirect()`.
 *
 * Ce n'est pas un détail de style : `redirect()` lève une exception pour interrompre le
 * rendu (R-D9). L'appeler depuis l'intérieur du `guard` obligerait ce dernier à la
 * distinguer d'un échec — ce qu'il sait faire, mais autant ne pas dépendre de cette
 * subtilité à chaque action. Rendre l'identifiant et laisser l'appelant naviguer supprime
 * la question, et rend l'action testable sans simuler le routeur.
 */
export async function createReviewAction(
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

    // FR-11 : le catalogue se remplit au premier avis. Le jeu est créé ici s'il n'existe
    // pas, et retrouvé à la casse près s'il existe.
    const gameId = await findOrCreateGame(data.gameTitle, data.steamUrl);

    const outcome = await createReview({
      gameId,
      authorId,
      isPrivate: data.isPrivate,
      overallScoreManual: data.overallScoreManual,
      playtimeHours: data.playtimeHours,
      completed: data.completed,
      whyRecommend: data.whyRecommend,
      whatMissed: data.whatMissed,
      whatHated: data.whatHated,
      whyNotRecommend: data.whyNotRecommend,
      domainScores: data.domainScores,
      screenshots: data.screenshots,
    });

    /*
     * Un avis existait déjà pour cette personne sur ce jeu.
     *
     * Ce n'est pas une panne : c'est la règle « une mise à jour est une modification, jamais
     * un second avis ». On renvoie l'identifiant de l'avis EXISTANT, ce qui permet à
     * l'interface d'y emmener l'auteur au lieu de lui demander de recommencer.
     */
    if (outcome.status === "alreadyReviewed") {
      return fail("ALREADY_REVIEWED");
    }

    // Invalidation déclarée route par route (INV-2, R-D3). Le cache de route de Next est
    // actif par défaut : sans ces appels, le nouvel avis n'apparaîtrait pas dans le fil.
    revalidatePath("/");
    revalidatePath("/games");
    revalidatePath(`/game/${gameId}`);
    revalidatePath("/profile");

    return ok({ reviewId: outcome.reviewId });
  });
}
