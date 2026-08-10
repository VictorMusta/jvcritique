"use server";

import { auth } from "~/server/auth";
import {
  compterNonLues,
  listerNotifications,
} from "~/server/db/queries/notifications";

/**
 * L'état des notifications de celui qui demande — interrogé périodiquement par l'interface.
 *
 * Demandé par Victor le 10 août 2026 : « j'aimerais que l'interface se mette à jour au moment
 * où une notif est reçue, car là faut recharger la page ».
 *
 * INTERROGATION PÉRIODIQUE, PAS DE FLUX PERSISTANT. Un canal ouvert en permanence — SSE ou
 * WebSocket — donnerait la seconde près, au prix d'une connexion maintenue par visiteur, d'un
 * gestionnaire de route à durée de vie longue, et d'un comportement à vérifier derrière le
 * proxy partagé. À cinq amis, une demande toutes les trente secondes coûte une requête
 * minuscule et rend exactement le service attendu : voir la pastille bouger sans recharger.
 *
 * NE LÈVE PAS et ne renvoie pas de `Result` : l'appelant est une boucle de fond, pas un geste
 * d'utilisateur. Une réponse vide est un état parfaitement acceptable — la boucle réessaiera
 * trente secondes plus tard, et il n'y a rien à afficher entre-temps.
 */
export type EtatNotifications = {
  nonLues: number;
  /** La plus récente, pour la notification système. `null` s'il n'y en a aucune. */
  derniere: { id: string; texte: string; reviewId: string } | null;
};

export async function etatNotificationsAction(): Promise<EtatNotifications> {
  const session = await auth();

  if (!session?.user?.id) {
    return { nonLues: 0, derniere: null };
  }

  const userId = session.user.id;

  try {
    const [nonLues, dernieres] = await Promise.all([
      compterNonLues(userId),
      listerNotifications(userId, 1),
    ]);

    const derniere = dernieres[0];

    return {
      nonLues,
      derniere:
        derniere === undefined || derniere.lue
          ? // Une notification DÉJÀ LUE ne doit pas ressortir : elle ferait sonner le
            // téléphone pour un évènement qu'on a vu, à chaque ouverture de l'application.
            null
          : {
              id: derniere.id,
              reviewId: derniere.reviewId,
              texte: `${derniere.actorName} ${verbe(derniere.kind)} ${derniere.gameTitle}`,
            },
    };
  } catch (erreur) {
    console.error("[notifications] état indisponible", erreur);
    return { nonLues: 0, derniere: null };
  }
}

function verbe(kind: "comment" | "reaction" | "edit"): string {
  switch (kind) {
    case "comment":
      return "a commenté ton avis sur";
    case "reaction":
      return "a réagi à ton avis sur";
    case "edit":
      return "a modifié ton avis sur";
  }
}
