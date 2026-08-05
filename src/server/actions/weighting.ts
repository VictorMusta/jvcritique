"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { replaceWeighting } from "~/server/db/queries/weighting";
import { fail, guard, ok, type Result } from "~/server/result";
import { weightingInputSchema } from "~/server/validation/weighting";

/**
 * Enregistre la Pondération de l'Utilisateur courant — FR-2.
 *
 * Trois règles s'appliquent ici et se retrouveront à l'identique dans chaque action :
 *
 * 1. **La session est vérifiée en première ligne.** Avant toute validation, avant tout
 *    accès à la base. Une action serveur est un point d'entrée HTTP public : rien ne
 *    garantit qu'elle a été appelée depuis l'interface qu'on a écrite.
 * 2. **Le corps passe par `guard()`** (D9 + R-D9), jamais par un `try/catch` maison. Le
 *    `guard` re-lance les erreurs de contrôle de Next au lieu de les avaler.
 * 3. **L'invalidation est déclarée explicitement, route par route** (INV-2, R-D3). Next
 *    possède un cache de route actif par défaut : sans ces appels, une pondération
 *    modifiée laisserait les notes relues figées sur leurs anciennes valeurs — précisément
 *    ce que « aucun cache » était censé éviter.
 */
export async function saveWeightingAction(input: unknown): Promise<Result<null>> {
  const session = await auth();

  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }

  const userId = session.user.id;

  return guard(async () => {
    const parsed = weightingInputSchema.safeParse(input);

    if (!parsed.success) {
      return fail("VALIDATION_FAILED");
    }

    await replaceWeighting(userId, parsed.data);

    // Toutes les surfaces qui affichent une Note relue. La liste est explicite et doit
    // grandir avec les routes : une surface oubliée ici affichera des notes périmées, et
    // rien ne le signalera.
    revalidatePath("/profile");
    revalidatePath("/feed");

    return ok(null);
  });
}
