"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "~/server/auth";
import { isAdmin } from "~/server/auth/is-admin";
import { updateGame } from "~/server/db/queries/games";
import { fail, guard, ok, type Result } from "~/server/result";

/**
 * Corrige un Jeu du catalogue — titre et lien Steam. **Administrateur uniquement.**
 *
 * Le lien Steam peut ainsi être ajouté APRÈS la publication, ce que FR-11 ne permettait pas :
 * le jeu naissait de son premier avis, avec ce que l'auteur avait sous la main à ce
 * moment-là.
 */
const gameInputSchema = z.object({
  title: z.string().trim().min(1).max(255),
  steamUrl: z.preprocess(
    (raw) => {
      if (typeof raw !== "string") {
        return null;
      }
      const trimmed = raw.trim();
      return trimmed.length === 0 ? null : trimmed;
    },
    z.string().url().max(2048).nullable(),
  ),
});

export async function updateGameAction(
  gameId: string,
  input: unknown,
): Promise<Result<null>> {
  const session = await auth();

  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }

  /*
   * Le contrôle d'administration est fait ICI, dans l'action, et pas seulement en masquant
   * le formulaire dans la page. Une action serveur est un point d'entrée HTTP public :
   * masquer un bouton n'empêche personne d'appeler la fonction.
   */
  if (!(await isAdmin(session.user.id))) {
    return fail("NOT_AUTHORIZED");
  }

  return guard(async () => {
    const parsed = gameInputSchema.safeParse(input);

    if (!parsed.success) {
      return fail("VALIDATION_FAILED");
    }

    const outcome = await updateGame(gameId, parsed.data);

    if (outcome === "notFound") {
      return fail("NOT_FOUND");
    }

    if (outcome === "duplicate") {
      // Un autre jeu porte déjà ce titre, à la casse près. Le dire précisément évite que
      // l'administrateur croie à une panne.
      return fail("ALREADY_EXISTS");
    }

    // Le titre apparaît partout où l'avis apparaît : toutes les surfaces sont concernées.
    revalidatePath("/");
    revalidatePath("/games");
    revalidatePath(`/game/${gameId}`);

    return ok(null);
  });
}
