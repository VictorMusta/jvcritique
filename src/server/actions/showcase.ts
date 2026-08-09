"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "~/server/auth";
import { remplacerVitrine, tousCritiquesPar } from "~/server/db/queries/showcase";
import { fail, guard, ok, type Result } from "~/server/result";

/**
 * Enregistre la vitrine de son profil — demandée par Victor.
 *
 * Cinq entrées au plus : c'est un « top 5 », et la borne est la fonctionnalité elle-même.
 * Une vitrine sans limite ne serait qu'une seconde liste d'avis.
 */
const vitrineSchema = z
  .array(
    z.object({
      gameId: z.string().uuid(),
      words: z.string().trim().min(1).max(60),
    }),
  )
  .max(5)
  .refine(
    (entrees) => new Set(entrees.map((e) => e.gameId)).size === entrees.length,
    { message: "Un même jeu ne peut pas occuper deux places." },
  );

export async function enregistrerVitrineAction(
  input: unknown,
): Promise<Result<null>> {
  const session = await auth();

  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }

  const userId = session.user.id;

  return guard(async () => {
    const parsed = vitrineSchema.safeParse(input);

    if (!parsed.success) {
      return fail(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ??
          "Chaque entrée demande un jeu et quelques mots, 60 caractères au plus.",
      );
    }

    /*
     * LE CONTRÔLE EST REFAIT ICI, alors que le menu ne propose déjà que ses propres jeux.
     *
     * Un menu n'est pas une garantie : une requête forgée y échappe. Sans cette
     * vérification, n'importe qui pourrait mettre en vitrine le jeu d'un autre — et la
     * jointure d'affichage, qui exige SON avis, ferait alors disparaître l'entrée sans
     * expliquer pourquoi.
     */
    const legitime = await tousCritiquesPar(
      userId,
      parsed.data.map((e) => e.gameId),
    );

    if (!legitime) {
      return fail(
        "NOT_AUTHORIZED",
        "On ne met en vitrine que des jeux qu’on a soi-même critiqués.",
      );
    }

    await remplacerVitrine(userId, parsed.data);

    revalidatePath("/profile");
    revalidatePath(`/profile/${userId}`);

    return ok(null);
  });
}
