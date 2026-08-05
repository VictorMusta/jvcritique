import { asc, eq, sql } from "drizzle-orm";

import { db } from "../index";
import { games } from "../schema";

/**
 * Trouve un Jeu par titre, à la casse près, ou le crée — FR-11 : « le catalogue se remplit
 * au premier avis posté ».
 *
 * La comparaison se fait sur `lower(title)`, exactement comme l'index unique : sinon
 * l'application chercherait « Valheim » sans le trouver alors que « valheim » existe, puis
 * tenterait une insertion que la base refuserait. Deux règles de normalisation divergentes
 * produisent une erreur qui n'a aucun sens pour l'utilisateur.
 *
 * `onConflictDoNothing` puis relecture, plutôt qu'un simple `insert` : deux personnes
 * publiant sur le même jeu au même instant passeraient toutes deux le test d'existence, et
 * la seconde insertion échouerait. Ici la course est absorbée.
 */
export async function findOrCreateGame(
  title: string,
  steamUrl: string | null,
): Promise<string> {
  const normalized = title.trim();

  const existing = await db
    .select({ id: games.id })
    .from(games)
    .where(sql`lower(${games.title}) = lower(${normalized})`)
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  const inserted = await db
    .insert(games)
    .values({ title: normalized, steamUrl })
    .onConflictDoNothing()
    .returning({ id: games.id });

  if (inserted[0]) {
    return inserted[0].id;
  }

  // Course perdue : quelqu'un a créé le jeu entre notre lecture et notre insertion. Il
  // existe donc maintenant, et c'est le résultat qu'on voulait.
  const raced = await db
    .select({ id: games.id })
    .from(games)
    .where(sql`lower(${games.title}) = lower(${normalized})`)
    .limit(1);

  if (!raced[0]) {
    throw new Error(
      `Le jeu « ${normalized} » n'a pu être ni trouvé ni créé après un conflit d'insertion.`,
    );
  }

  return raced[0].id;
}

export async function getGameById(id: string) {
  const rows = await db.select().from(games).where(eq(games.id, id)).limit(1);

  return rows[0] ?? null;
}

/**
 * Catalogue complet, par ordre alphabétique.
 *
 * Sans pagination en V0 : le catalogue ne contient que les jeux réellement critiqués par
 * cinq personnes. Le jour où ce n'est plus vrai, cette fonction est le seul endroit à
 * changer.
 */
export async function listGames() {
  return db.select().from(games).orderBy(asc(games.title));
}
