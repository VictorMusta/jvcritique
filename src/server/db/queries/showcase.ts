import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "../index";
import { games, profileShowcase, reviews } from "../schema";

/**
 * FRONTIÈRE 2 — seul endroit qui parle à la base.
 *
 * La vitrine d'un profil : le « top 5 » que quelqu'un met en avant, demandé par Victor le
 * 10 août 2026.
 */

export type EntreeVitrine = {
  position: number;
  gameId: string;
  gameTitle: string;
  words: string;
  /** Identifiant de SON avis sur ce jeu — il existe toujours, la table l'impose. */
  reviewId: string;
  /** Note saisie à la main, ou `null` si l'avis n'en porte pas. */
  scoreManuel: number | null;
};

/**
 * La vitrine de quelqu'un, dans l'ordre qu'il a choisi.
 *
 * La jointure sur l'avis est INTERNE et non externe : une entrée dont l'avis a disparu ne
 * doit pas s'afficher amputée de sa note et de son lien. Elle disparaît, ce qui est le
 * comportement juste — la vitrine met en avant des avis, pas des titres.
 */
export async function getVitrine(userId: string): Promise<EntreeVitrine[]> {
  return db
    .select({
      position: profileShowcase.position,
      gameId: profileShowcase.gameId,
      gameTitle: games.title,
      words: profileShowcase.words,
      reviewId: reviews.id,
      scoreManuel: reviews.overallScoreManual,
    })
    .from(profileShowcase)
    .innerJoin(games, eq(games.id, profileShowcase.gameId))
    .innerJoin(
      reviews,
      and(
        eq(reviews.gameId, profileShowcase.gameId),
        eq(reviews.authorId, profileShowcase.userId),
      ),
    )
    .where(eq(profileShowcase.userId, userId))
    .orderBy(asc(profileShowcase.position));
}

/**
 * Remplace la vitrine entière.
 *
 * TOUT EST RÉÉCRIT, jamais modifié ligne par ligne. Réordonner cinq entrées avec des
 * positions uniques par des mises à jour successives passerait forcément par un état
 * intermédiaire où deux jeux occupent la même place — que la contrainte refuserait. Effacer
 * puis réinsérer supprime le problème au lieu de le contourner.
 *
 * Dans une TRANSACTION : sans elle, un échec à l'insertion laisserait la vitrine vide alors
 * que la personne voulait seulement la modifier.
 */
export async function remplacerVitrine(
  userId: string,
  entrees: readonly { gameId: string; words: string }[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(profileShowcase).where(eq(profileShowcase.userId, userId));

    if (entrees.length === 0) {
      return;
    }

    await tx.insert(profileShowcase).values(
      entrees.map((e, rang) => ({
        userId,
        gameId: e.gameId,
        // La position vient de l'ORDRE REÇU, pas d'un champ : le formulaire ordonne les
        // lignes, et un numéro saisi à part finirait par contredire ce qu'on voit.
        position: rang + 1,
        words: e.words,
      })),
    );
  });
}

/**
 * Les jeux que la personne a critiqués — les seuls qu'elle puisse mettre en vitrine.
 *
 * Le contrôle est refait à l'enregistrement : cette liste sert à remplir un menu, et un menu
 * n'est pas une garantie. Une requête forgée passerait à côté.
 */
export async function jeuxCritiquesPar(
  userId: string,
): Promise<{ gameId: string; title: string }[]> {
  return db
    .select({ gameId: games.id, title: games.title })
    .from(reviews)
    .innerJoin(games, eq(games.id, reviews.gameId))
    .where(eq(reviews.authorId, userId))
    .orderBy(asc(games.title));
}

/** Vrai si tous ces jeux ont bien été critiqués par cette personne. */
export async function tousCritiquesPar(
  userId: string,
  gameIds: readonly string[],
): Promise<boolean> {
  if (gameIds.length === 0) {
    return true;
  }

  const lignes = await db
    .select({ gameId: reviews.gameId })
    .from(reviews)
    .where(
      and(eq(reviews.authorId, userId), inArray(reviews.gameId, [...gameIds])),
    );

  return new Set(lignes.map((l) => l.gameId)).size === new Set(gameIds).size;
}
