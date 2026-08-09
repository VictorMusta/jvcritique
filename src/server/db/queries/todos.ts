import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../index";
import { gameTodos, games } from "../schema";

/**
 * FRONTIÈRE 2 — seul endroit qui parle à la base.
 *
 * Liste de jeux à faire, demandée par Victor le 10 août 2026. Elle remplace la réaction
 * « ça me tente », qui n'en était pas une : les deux autres jugent l'avis, celle-là exprimait
 * une intention sur le JEU.
 */

export type JeuAFaire = {
  gameId: string;
  title: string;
  steamUrl: string | null;
  ajouteLe: Date;
};

/**
 * Ajoute ou retire, selon l'état actuel. Rend `true` si le jeu est désormais dans la liste.
 *
 * Une seule action pour les deux sens : le bouton est un interrupteur, et deux actions
 * distinctes laisseraient l'appelant décider laquelle appeler — donc se tromper le jour où
 * l'état affiché aura pris du retard sur la base.
 */
export async function basculerTodo(
  userId: string,
  gameId: string,
): Promise<boolean> {
  const supprimees = await db
    .delete(gameTodos)
    .where(and(eq(gameTodos.userId, userId), eq(gameTodos.gameId, gameId)))
    .returning({ gameId: gameTodos.gameId });

  if (supprimees.length > 0) {
    return false;
  }

  await db
    .insert(gameTodos)
    .values({ userId, gameId })
    // La clé primaire refuse déjà le doublon ; sans cette clause, deux clics très rapprochés
    // feraient remonter une erreur de contrainte pour un geste parfaitement innocent.
    .onConflictDoNothing();

  return true;
}

/**
 * Parmi une liste de jeux, ceux qui sont déjà dans la liste de la personne.
 *
 * Prend un TABLEAU et rend un ensemble : une page affiche vingt avis, et interroger la base
 * une fois par avis donnerait vingt requêtes pour une information de vingt octets. C'est la
 * même contrainte qui avait imposé le chargement groupé des pondérations.
 */
export async function todosParmi(
  userId: string | null,
  gameIds: readonly string[],
): Promise<Set<string>> {
  if (userId === null || gameIds.length === 0) {
    return new Set();
  }

  const lignes = await db
    .select({ gameId: gameTodos.gameId })
    .from(gameTodos)
    .where(
      and(eq(gameTodos.userId, userId), inArray(gameTodos.gameId, [...gameIds])),
    );

  return new Set(lignes.map((l) => l.gameId));
}

/** La liste d'une personne, la plus récente envie en tête. */
export async function listerTodo(userId: string): Promise<JeuAFaire[]> {
  return db
    .select({
      gameId: games.id,
      title: games.title,
      steamUrl: games.steamUrl,
      ajouteLe: gameTodos.createdAt,
    })
    .from(gameTodos)
    .innerJoin(games, eq(games.id, gameTodos.gameId))
    .where(eq(gameTodos.userId, userId))
    .orderBy(desc(gameTodos.createdAt));
}
