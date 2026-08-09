"use server";

import { auth } from "~/server/auth";
import { isAdmin } from "~/server/auth/is-admin";
import {
  countPendingAnnouncements,
  getPendingAnnouncements,
  markAnnounced,
} from "~/server/db/queries/announcements";
import { annoncerAvis } from "~/server/discord";
import { fail, guard, ok, type Result } from "~/server/result";

/**
 * Rattrape les avis publiés AVANT que le webhook Discord n'existe. **Administrateur seul.**
 *
 * POURQUOI UNE ACTION DANS L'APPLICATION, ET PAS UN SCRIPT. L'annonce doit traverser le
 * parseur de spoilers, et R-D6 interdit une seconde implémentation : deux versions divergent,
 * et la divergence EST le trou. Un script séparé n'a pas accès au code compilé — il aurait
 * fallu recopier la grammaire, c'est-à-dire créer exactement le problème que R-D6 interdit.
 *
 * Réservé aux administrateurs parce que le geste est SORTANT et IRRÉVERSIBLE : il écrit dans
 * un salon que cinq personnes lisent, et un message Discord ne se reprend pas.
 */

/**
 * Nombre d'annonces par clic.
 *
 * Deux bornes se rencontrent ici. Discord limite un webhook à quelques messages par minute :
 * les envoyer d'un coup en ferait rejeter la moitié. Et une action serveur qui durerait des
 * minutes se ferait couper par le proxy inverse, en laissant l'état à moitié écrit.
 *
 * Le reste attend le clic suivant, et le bouton l'annonce.
 */
const PAR_CLIC = 12;

/** Espacement entre deux envois — sous la limite documentée du webhook. */
const RESPIRATION_MS = 2500;

export type Rattrapage = { envoyes: number; restants: number };

export async function annoncerLeRetardAction(): Promise<Result<Rattrapage>> {
  return guard(async () => {
    const session = await auth();

    if (!session?.user?.id) {
      return fail("NOT_AUTHENTICATED");
    }

    if (!(await isAdmin(session.user.id))) {
      return fail("NOT_AUTHORIZED");
    }

    const lot = await getPendingAnnouncements(PAR_CLIC);

    let envoyes = 0;

    for (const [rang, avis] of lot.entries()) {
      // Respiration AVANT chaque envoi sauf le premier : attendre après le dernier ferait
      // patienter l'utilisateur pour rien.
      if (rang > 0) {
        await new Promise((resolve) => setTimeout(resolve, RESPIRATION_MS));
      }

      const parti = await annoncerAvis({ ...avis, isPrivate: false });

      /*
       * Un échec ARRÊTE le lot, il ne le saute pas.
       *
       * Si Discord refuse, c'est presque toujours une raison qui vaudra aussi pour les
       * suivants — webhook révoqué, salon supprimé, limite atteinte. Continuer produirait
       * onze échecs de plus et brouillerait le diagnostic. Les avis non envoyés restent non
       * marqués : rien n'est perdu, un clic plus tard reprend où on s'est arrêté.
       */
      if (!parti) {
        break;
      }

      await markAnnounced(avis.reviewId);
      envoyes += 1;
    }

    return ok({ envoyes, restants: await countPendingAnnouncements() });
  });
}
