"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { basculerTodo } from "~/server/db/queries/todos";
import { fail, guard, ok, type Result } from "~/server/result";

/**
 * Ajoute ou retire un jeu de sa liste — demandé par Victor.
 *
 * AUCUNE VÉRIFICATION DE VISIBILITÉ, et c'est correct : la liste porte sur un JEU, et le
 * catalogue est public. Contrairement aux réactions, il n'y a rien à protéger — on
 * n'apprend rien sur personne en notant qu'on veut essayer un jeu.
 *
 * Rien n'empêche non plus d'y mettre un jeu qu'on a déjà critiqué : c'est sa liste, elle ne
 * regarde que lui, et le produit n'a pas à corriger ses intentions.
 */
export async function todoAction(gameId: unknown): Promise<Result<{ dansLaListe: boolean }>> {
  const session = await auth();

  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }

  // Capturé AVANT le `guard` : le contrôle ci-dessus a déjà prouvé qu'il existe, et le
  // relire à l'intérieur obligerait à le re-vérifier ou à l'affirmer.
  const userId = session.user.id;

  return guard(async () => {
    if (typeof gameId !== "string" || gameId.length === 0) {
      return fail("VALIDATION_FAILED");
    }

    const dansLaListe = await basculerTodo(userId, gameId);

    // La liste s'affiche sur le profil : sans invalidation, on l'y trouverait inchangée.
    revalidatePath("/profile");

    return ok({ dansLaListe });
  });
}
