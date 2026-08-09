import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "../index";
import { games, notifications, reviews, users } from "../schema";

/**
 * FRONTIÈRE 2 — seul endroit qui parle à la base.
 *
 * Notifications dans l'application, demandées par Victor : « il faut que les utilisateurs
 * soient notifiés quand un de leurs avis a été modifié, commenté, ou qu'on a cliqué sur un
 * des trois boutons d'en bas ».
 */

export type NotificationKind = "comment" | "reaction" | "edit";

export type NotificationPourAffichage = {
  id: string;
  kind: NotificationKind;
  createdAt: Date;
  lue: boolean;
  reviewId: string;
  gameTitle: string;
  actorName: string;
};

/**
 * Enregistre un évènement à destination de l'auteur d'un Avis.
 *
 * NE LÈVE JAMAIS, et c'est la propriété qui compte ici. Une notification est un accessoire :
 * un commentaire publié dont la notification échoue reste un commentaire publié. Faire
 * remonter l'erreur transformerait un geste réussi en échec à l'écran, pour une pastille.
 *
 * Le destinataire est déduit de l'avis, jamais reçu en paramètre : l'appelant n'a pas à
 * connaître l'auteur, et une erreur de sa part enverrait la notification à la mauvaise
 * personne. Un avis introuvable ne produit rien, en silence — c'est le cas d'un avis
 * supprimé entre l'action et son enregistrement.
 */
export async function notifier(input: {
  reviewId: string;
  actorId: string;
  kind: NotificationKind;
}): Promise<void> {
  try {
    const [avis] = await db
      .select({ authorId: reviews.authorId })
      .from(reviews)
      .where(eq(reviews.id, input.reviewId))
      .limit(1);

    if (avis === undefined || avis.authorId === input.actorId) {
      // Agir sur son propre avis ne notifie personne. Vérifié ici ET par une contrainte de
      // la base : le contrôle en amont évite une erreur inutile, celui en aval garantit
      // qu'aucun chemin ne l'oublie.
      return;
    }

    await db.insert(notifications).values({
      userId: avis.authorId,
      actorId: input.actorId,
      reviewId: input.reviewId,
      kind: input.kind,
    });
  } catch (erreur) {
    console.error("[notifications] enregistrement impossible", erreur);
  }
}

/** Combien de notifications l'utilisateur n'a pas encore lues. */
export async function compterNonLues(userId: string | null): Promise<number> {
  if (userId === null) {
    return 0;
  }

  const [ligne] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

  return ligne?.n ?? 0;
}

/**
 * Les notifications d'un utilisateur, les plus récentes d'abord.
 *
 * Bornée. Une liste sans limite finirait par charger des centaines de lignes qu'on ne
 * regarde pas — et personne ne remonte au-delà de quelques jours dans une liste d'activité.
 */
export async function listerNotifications(
  userId: string,
  limite = 50,
): Promise<NotificationPourAffichage[]> {
  const lignes = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      reviewId: notifications.reviewId,
      gameTitle: games.title,
      actorName: users.name,
    })
    .from(notifications)
    .innerJoin(reviews, eq(reviews.id, notifications.reviewId))
    .innerJoin(games, eq(games.id, reviews.gameId))
    .innerJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limite);

  return lignes.map((l) => ({
    id: l.id,
    kind: l.kind,
    createdAt: l.createdAt,
    lue: l.readAt !== null,
    reviewId: l.reviewId,
    gameTitle: l.gameTitle,
    actorName: l.actorName ?? "Quelqu'un",
  }));
}

/**
 * Marque tout comme lu.
 *
 * Appelé quand la page d'activité est OUVERTE, pas au clic sur une ligne : ouvrir la liste,
 * c'est avoir vu ce qu'elle contient. Exiger un clic par ligne laisserait une pastille
 * allumée sur des évènements déjà lus, ce qui apprend à l'ignorer.
 *
 * Ne touche que les lignes non lues — sans le filtre, chaque ouverture réécrirait toute la
 * table pour rien.
 */
export async function marquerToutesLues(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
