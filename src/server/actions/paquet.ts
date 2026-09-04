"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { GESTES } from "~/domain/paquet/geste";
import { auth } from "~/server/auth";
import { notifier } from "~/server/db/queries/notifications";
import { setReaction } from "~/server/db/queries/reactions";
import { getReviewById } from "~/server/db/queries/reviews";
import { ajouterTodo } from "~/server/db/queries/todos";
import { marquerVu } from "~/server/db/queries/vus";
import { fail, guard, ok, type Result } from "~/server/result";

const entreeCarte = z.object({
  reviewId: z.string().uuid(),
  geste: z.enum(GESTES),
});

/**
 * Traite une carte du paquet : applique le geste, puis pose la marque « vu ».
 *
 * L'ordre compte. Le geste d'abord, la marque ensuite : si la réaction échoue, la carte
 * n'est pas marquée et reviendra — mieux qu'un avis « vu » dont le « j'aime » s'est perdu.
 *
 * Trois gestes sur quatre délèguent à ce qui existe : la réaction haut/bas (et sa
 * notification, comme depuis le bouton de la page), la liste de souhaits. Le paquet n'invente
 * aucune donnée nouvelle en dehors de la marque elle-même.
 *
 * PAS DE `revalidatePath("/")` ICI, volontairement. Le fil ne doit pas se re-rendre entre
 * deux cartes : côté serveur, un avis marqué vu sort de la liste des non-vus, et un re-rendu
 * de la page d'accueil ferait disparaître le paquet sous les pieds de la personne avant
 * qu'elle ait vu la dernière carte et le bilan. C'est le composant qui demande le
 * rafraîchissement, quand il rend la main au fil.
 */
export async function traiterCarteAction(
  reviewId: unknown,
  geste: unknown,
): Promise<Result<null>> {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }
  const userId = session.user.id;

  return guard(async () => {
    const parsed = entreeCarte.safeParse({ reviewId, geste });
    if (!parsed.success) {
      return fail("VALIDATION_FAILED");
    }

    // Identité et droits viennent de la session et de la base, jamais du client : on ne
    // marque pas un avis qui n'existe pas, qu'on n'a pas le droit de voir, ou qu'on a écrit.
    const avis = await getReviewById(parsed.data.reviewId);
    if (!avis || (avis.isPrivate && avis.author.id !== userId) || avis.author.id === userId) {
      return fail("NOT_FOUND");
    }

    switch (parsed.data.geste) {
      case "aime":
      case "pas_pour_moi": {
        const kind = parsed.data.geste === "aime" ? "up" : "down";
        const done = await setReaction(avis.id, userId, kind);
        if (done) {
          await notifier({ reviewId: avis.id, actorId: userId, kind: "reaction" });
        }
        break;
      }
      case "souhait":
        await ajouterTodo(userId, avis.game.id);
        break;
      case "passer":
        break;
    }

    await marquerVu(userId, avis.id);

    revalidatePath(`/review/${avis.id}`);
    revalidatePath("/profile");
    return ok(null);
  });
}

/**
 * Pose la marque « vu » quand on ouvre un avis en entier.
 *
 * Appelée depuis un effet CLIENT, pas pendant le rendu de la page : Next préchage les liens
 * du fil au survol et à l'apparition dans la fenêtre, et un rendu serveur qui écrirait la
 * marque « verrait » des avis que personne n'a ouverts. Un effet ne s'exécute que dans un
 * onglet qui affiche réellement la page.
 */
export async function marquerVuAction(reviewId: unknown): Promise<Result<null>> {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("NOT_AUTHENTICATED");
  }
  const userId = session.user.id;

  return guard(async () => {
    const parsed = z.string().uuid().safeParse(reviewId);
    if (!parsed.success) {
      return fail("VALIDATION_FAILED");
    }
    const avis = await getReviewById(parsed.data);
    // Son propre avis n'est jamais « à voir » ; un avis privé d'un autre n'est pas visible.
    if (!avis || avis.author.id === userId || avis.isPrivate) {
      return ok(null);
    }
    await marquerVu(userId, avis.id);
    return ok(null);
  });
}
