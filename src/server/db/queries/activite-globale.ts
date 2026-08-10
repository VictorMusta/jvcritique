import { sql } from "drizzle-orm";

import { db } from "../index";

/**
 * FRONTIÈRE 2 — seul endroit qui parle à la base.
 *
 * Tout ce qui se passe sur le site, pour un administrateur — demandé par Victor le 10 août
 * 2026 : « un onglet activité globale dans mon truc onglet activité d'administrateur, ça
 * intéresse pas mes collègues ».
 *
 * ELLE NE PEUT PAS VENIR DE LA TABLE DES NOTIFICATIONS, et c'est la première chose à
 * comprendre. Celle-ci n'enregistre que ce qui est ADRESSÉ à quelqu'un : elle exclut par
 * contrainte ce qu'on fait sur ses propres avis, et une publication n'y figure pas du tout.
 * Un fil bâti dessus montrerait un site où personne ne publie jamais et où l'on ne commente
 * que les autres.
 *
 * Elle est donc reconstruite depuis les trois sources, réunies par une seule requête.
 *
 * TOUT CE QUI TOUCHE UN AVIS PRIVÉ EST ÉCARTÉ, et ce n'est pas une précaution de trop.
 * Commenter un avis privé n'est possible qu'à son auteur — la vérification est dans
 * `addComment`. Afficher ce commentaire à un administrateur révélerait donc l'EXISTENCE de
 * l'avis caché, et son sujet, à quelqu'un à qui son auteur ne l'a pas montré. Être
 * administrateur donne des pouvoirs d'entretien, pas un droit de regard.
 */

export type EvenementGlobal = {
  kind: "avis" | "commentaire" | "reaction";
  quand: Date;
  qui: string;
  reviewId: string;
  gameTitle: string;
  /** `up` ou `down` pour une réaction, `null` sinon. */
  detail: string | null;
};

export async function activiteGlobale(limite = 60): Promise<EvenementGlobal[]> {
  /*
   * UNE SEULE REQUÊTE plutôt que trois puis un tri en mémoire.
   *
   * Trois requêtes bornées à soixante donneraient cent quatre-vingts lignes à trier pour n'en
   * garder que soixante — et surtout, la borne s'appliquerait AVANT la réunion : soixante
   * réactions récentes masqueraient toutes les publications, qui sont plus rares. La limite
   * doit porter sur le fil réuni, ce que seule une union sait faire.
   */
  const lignes = await db.execute<{
    kind: "avis" | "commentaire" | "reaction";
    quand: string;
    qui: string | null;
    reviewid: string;
    gametitle: string;
    detail: string | null;
  }>(sql`
    select 'avis' as kind, r."createdAt" as quand, u.name as qui,
           r.id as reviewid, g.title as gametitle, null as detail
      from jvcritique_review r
      join jvcritique_user u on u.id = r."authorId"
      join jvcritique_game g on g.id = r."gameId"
     where r."isPrivate" = false

    union all

    select 'commentaire', c."createdAt", u.name,
           r.id, g.title, null
      from jvcritique_review_comment c
      join jvcritique_review r on r.id = c."reviewId"
      join jvcritique_user u on u.id = c."authorId"
      join jvcritique_game g on g.id = r."gameId"
     where r."isPrivate" = false

    union all

    select 'reaction', a."createdAt", u.name,
           r.id, g.title, a.kind::text
      from jvcritique_review_reaction a
      join jvcritique_review r on r.id = a."reviewId"
      join jvcritique_user u on u.id = a."userId"
      join jvcritique_game g on g.id = r."gameId"
     where r."isPrivate" = false

     order by quand desc
     limit ${limite}
  `);

  return lignes.map((l) => ({
    kind: l.kind,
    // `execute` rend les colonnes brutes : une date arrive en chaîne, et la convertir ici
    // évite que chaque surface d'affichage ait à s'en souvenir.
    quand: new Date(l.quand),
    qui: l.qui ?? "Quelqu'un",
    reviewId: l.reviewid,
    gameTitle: l.gametitle,
    detail: l.detail,
  }));
}
