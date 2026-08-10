import { asc, count, eq, inArray, sql } from "drizzle-orm";

import { db } from "../index";
import { games, reviews } from "../schema";

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

/**
 * Résultat d'une modification de Jeu.
 *
 * Une union plutôt qu'un booléen : « le jeu n'existe pas » et « ce titre est déjà pris » ne
 * se corrigent pas de la même façon, et l'utilisateur a besoin de savoir lequel des deux
 * s'est produit.
 */
export type UpdateGameOutcome = "ok" | "notFound" | "duplicate";

/**
 * Corrige le titre et le lien Steam d'un Jeu.
 *
 * Renommer un Jeu n'est PAS la même chose que changer le jeu dont parle un avis. Le second
 * reviendrait à écrire un autre avis, et reste interdit. Le premier est de l'entretien de
 * catalogue : il corrige une donnée partagée sans toucher aux mots de personne. J'avais
 * confondu les deux en bloquant le champ dans le formulaire de modification, et une faute
 * de frappe dans un titre est devenue incorrigible — trouvée à l'usage par une amie de
 * Victor le jour du lancement.
 *
 * Le conflit d'unicité est INTERCEPTÉ plutôt que laissé remonter : l'index porte sur
 * `lower(title)`, donc renommer « Valheim » en « valheim » alors qu'un autre existe échoue,
 * et une exception brute donnerait un message générique là où on peut être précis.
 */
export async function updateGame(
  id: string,
  input: { title: string; steamUrl: string | null },
): Promise<UpdateGameOutcome> {
  try {
    const updated = await db
      .update(games)
      .set({ title: input.title.trim(), steamUrl: input.steamUrl })
      .where(eq(games.id, id))
      .returning({ id: games.id });

    return updated.length > 0 ? "ok" : "notFound";
  } catch (error) {
    // 23505 = violation de contrainte d'unicité côté PostgreSQL.
    const code = (error as { code?: string })?.code;

    if (code === "23505") {
      return "duplicate";
    }

    throw error;
  }
}

export async function getGameById(id: string) {
  const rows = await db.select().from(games).where(eq(games.id, id)).limit(1);

  return rows[0] ?? null;
}

/**
 * Catalogue avec le nombre d'avis de chacun, pour l'aide à la saisie.
 *
 * La liste ENTIÈRE est renvoyée au client, qui filtre lui-même. À cinq amis le catalogue
 * tient en quelques dizaines d'entrées : une route de recherche, son anti-rebond et ses
 * allers-retours réseau coûteraient plus de code et plus de latence que d'envoyer le tout.
 *
 * Le jour où le catalogue dépassera quelques centaines de jeux, cette fonction est le seul
 * endroit à changer — et ce jour-là seulement.
 */
export async function listGamesForPicker(): Promise<
  { id: string; title: string; reviewCount: number }[]
> {
  const rows = await db
    .select({
      id: games.id,
      title: games.title,
      reviewCount: count(reviews.id),
    })
    .from(games)
    .leftJoin(reviews, eq(reviews.gameId, games.id))
    .groupBy(games.id, games.title)
    .orderBy(asc(games.title));

  return rows;
}

/**
 * Catalogue complet, par ordre alphabétique.
 *
 * Sans pagination en V0 : le catalogue ne contient que les jeux réellement critiqués par
 * cinq personnes. Le jour où ce n'est plus vrai, cette fonction est le seul endroit à
 * changer.
 */
export async function listGames(viewerId: string | null = null) {
  /*
   * Le nombre d'avis compte les seuls avis PUBLICS, et c'est une décision de confidentialité
   * plutôt qu'une simplification.
   *
   * Compter les avis privés ferait afficher « 3 avis » sur une fiche qui n'en montre que
   * deux : l'écart révélerait à tout le monde qu'un avis caché existe, ce que FR-17 sert
   * précisément à empêcher. Le compte est le même pour tous, y compris pour l'auteur de
   * l'avis privé — qui sait déjà qu'il l'a écrit.
   */
  return db
    .select({
      id: games.id,
      title: games.title,
      steamUrl: games.steamUrl,
      createdAt: games.createdAt,
      nbAvis: sql<number>`count(${reviews.id}) filter (where ${reviews.isPrivate} = false)::int`,
      /*
       * Deux marqueurs personnels, demandés par Victor : une coche pour les jeux dont on a
       * écrit l'avis, une couronne pour ceux qu'on a marqués terminés.
       *
       * Agrégés dans la MÊME requête plutôt que par une seconde passe : la liste des jeux est
       * une page à nombre de requêtes borné, et interroger ses propres avis à part
       * n'apporterait rien qu'un aller-retour de plus.
       *
       * Le filtre porte sur l'auteur : ce sont SES avis, pas ceux du groupe. Sans lui, la
       * coche s'allumerait dès que n'importe qui a écrit sur le jeu.
       */
      jaiUnAvis: sql<boolean>`bool_or(${reviews.authorId} is not distinct from ${viewerId})`,
      jaiTermine: sql<boolean>`bool_or(${reviews.authorId} is not distinct from ${viewerId} and ${reviews.completed})`,
    })
    .from(games)
    .leftJoin(reviews, eq(reviews.gameId, games.id))
    .groupBy(games.id)
    .orderBy(asc(games.title));
}

/**
 * Titres de plusieurs jeux, par identifiant — pour résoudre les mentions à l'affichage.
 *
 * Un seul appel pour toute une page : un fil de commentaires qui interrogerait la base par
 * mention donnerait autant de requêtes que de mentions. C'est la contrainte qui avait déjà
 * imposé le chargement groupé des pondérations.
 *
 * Un identifiant absent du résultat — jeu supprimé — n'est pas une erreur : l'affichage rend
 * alors du texte au lieu d'un lien mort.
 */
export async function titresDeJeux(
  ids: readonly string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) {
    return {};
  }

  const lignes = await db
    .select({ id: games.id, title: games.title })
    .from(games)
    .where(inArray(games.id, [...ids]));

  return Object.fromEntries(lignes.map((l) => [l.id, l.title]));
}
