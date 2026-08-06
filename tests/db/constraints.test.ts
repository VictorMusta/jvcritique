import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Tests d'INTÉGRATION — ils exigent un PostgreSQL migré et ne tournent donc pas avec
 * `npm test`. Lancement : `npm run test:db`.
 *
 * Ce qu'ils vérifient est précisément ce qu'un test unitaire ne peut pas atteindre : que
 * la BASE refuse les états interdits, indépendamment du code applicatif. Une contrainte
 * qu'on n'a jamais vue rejeter quelque chose n'est pas une contrainte, c'est un
 * commentaire.
 *
 * Ils existent parce que la première version de `review_domain_score_exclusive` a
 * réellement laissé passer une ligne vide : une contrainte `CHECK` de PostgreSQL ne
 * rejette une ligne que si son expression vaut `FALSE`, et l'expression valait `NULL`.
 * Ni le typage ni les tests unitaires ne pouvaient le voir.
 */

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL est requis pour les tests d'intégration. Voir README, section Développement local.",
  );
}

const sql = postgres(url, { max: 1, onnotice: () => undefined });

// Préfixe propre à l'exécution : les tests ne se marchent pas dessus et ne dépendent pas
// d'une base vierge.
const run = `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const userId = `${run}-user`;
let gameId: string;
let reviewId: string;

/** Tente une insertion et rend le nom de la contrainte violée, ou `null` si ça a passé. */
async function violatedConstraint(
  insert: () => Promise<unknown>,
): Promise<string | null> {
  try {
    await insert();
    return null;
  } catch (error) {
    const name = (error as { constraint_name?: string }).constraint_name;
    return name ?? "(contrainte non nommée)";
  }
}

beforeAll(async () => {
  await sql`insert into jvcritique_user (id, email, name)
            values (${userId}, ${`${run}@exemple.fr`}, 'Testeur')`;

  const [game] = await sql<{ id: string }[]>`
    insert into jvcritique_game (title) values (${`Jeu ${run}`}) returning id`;
  gameId = game!.id;

  const [review] = await sql<{ id: string }[]>`
    insert into jvcritique_review ("gameId", "authorId")
    values (${gameId}, ${userId}) returning id`;
  reviewId = review!.id;
});

afterAll(async () => {
  // Les cascades emportent avis, notes de domaine et pondérations.
  await sql`delete from jvcritique_user where id = ${userId}`;
  await sql`delete from jvcritique_game where id = ${gameId}`;
  await sql.end();
});

const insertDomainScore = (
  domain: string,
  value: number | null,
  notApplicable: boolean,
) =>
  sql`insert into jvcritique_review_domain_score ("reviewId", domain, value, "notApplicable")
      values (${reviewId}, ${domain}::jvcritique_domain, ${value}, ${notApplicable})`;

describe("Note de domaine — les trois états, garantis par la base (D1)", () => {
  it("accepte une note de 0 à 20", async () => {
    expect(await violatedConstraint(() => insertDomainScore("gameplay", 16, false))).toBeNull();
  });

  it("accepte ZÉRO — c'est un jugement sévère, pas une absence", async () => {
    expect(await violatedConstraint(() => insertDomainScore("technical", 0, false))).toBeNull();
  });

  it("accepte « pas évaluable » sans note", async () => {
    expect(await violatedConstraint(() => insertDomainScore("story", null, true))).toBeNull();
  });

  it("REFUSE « pas évaluable » accompagné d'une note", async () => {
    expect(await violatedConstraint(() => insertDomainScore("atmosphere", 12, true))).toBe(
      "review_domain_score_exclusive",
    );
  });

  it("REFUSE une ligne qui n'affirme rien — le défaut du NULL dans un CHECK", async () => {
    // LE test qui a trouvé un vrai bug.
    //
    // `notApplicable = false` avec `value = NULL` décrit une ligne qui ne dit ni « voici
    // ma note » ni « ce domaine ne s'applique pas ». Sans le `IS NOT NULL` explicite,
    // l'expression du CHECK s'évaluait à NULL et PostgreSQL acceptait la ligne — une
    // contrainte ne rejette que sur FALSE.
    expect(await violatedConstraint(() => insertDomainScore("soundtrack", null, false))).toBe(
      "review_domain_score_exclusive",
    );
  });

  it("REFUSE une note hors des bornes 0 à 20", async () => {
    expect(await violatedConstraint(() => insertDomainScore("pacing", 21, false))).toBe(
      "review_domain_score_exclusive",
    );
  });

  it("REFUSE un domaine absent du glossaire", async () => {
    // Le type énuméré est dérivé de DOMAIN_KEYS : la base ne connaît que les sept axes.
    await expect(insertDomainScore("graphismes", 10, false)).rejects.toThrow();
  });

  it("REFUSE deux fois le même domaine dans un avis", async () => {
    await insertDomainScore("artDirection", 14, false);
    expect(await violatedConstraint(() => insertDomainScore("artDirection", 15, false))).toBe(
      "jvcritique_review_domain_score_reviewId_domain_pk",
    );
  });
});

describe("Pondération — bornes garanties par la base (FR-2)", () => {
  it("accepte 0 et 100", async () => {
    expect(
      await violatedConstraint(
        () =>
          sql`insert into jvcritique_weighting ("userId", domain, weight)
              values (${userId}, 'gameplay'::jvcritique_domain, 0),
                     (${userId}, 'story'::jvcritique_domain, 100)`,
      ),
    ).toBeNull();
  });

  it("REFUSE un poids au-delà de 100", async () => {
    expect(
      await violatedConstraint(
        () =>
          sql`insert into jvcritique_weighting ("userId", domain, weight)
              values (${userId}, 'atmosphere'::jvcritique_domain, 150)`,
      ),
    ).toBe("weighting_weight_range");
  });
});

describe("Avis — unicité et bornes (FR-5, FR-9, FR-22)", () => {
  it("REFUSE un second avis du même auteur sur le même jeu", async () => {
    // Une mise à jour est une modification (FR-9) ou une Note de mise à jour (FR-10),
    // jamais un second Avis.
    expect(
      await violatedConstraint(
        () =>
          sql`insert into jvcritique_review ("gameId", "authorId")
              values (${gameId}, ${userId})`,
      ),
    ).toBe("review_author_game_idx");
  });

  it("REFUSE une note globale manuelle hors bornes", async () => {
    expect(
      await violatedConstraint(
        () =>
          sql`insert into jvcritique_review ("gameId", "authorId", "overallScoreManual")
              values (${gameId}, ${`${userId}-bis`}, 25)`,
      ),
    ).toBe("review_overall_score_range");
  });

  it("REFUSE un temps de jeu négatif", async () => {
    expect(
      await violatedConstraint(
        () =>
          sql`insert into jvcritique_review ("gameId", "authorId", "playtimeHours")
              values (${gameId}, ${`${userId}-ter`}, -5)`,
      ),
    ).toBe("review_playtime_non_negative");
  });
});

describe("Note de mise à jour — corps non vide (FR-10)", () => {
  const insertNote = (body: string) =>
    sql`insert into jvcritique_review_update_note ("reviewId", body) values (${reviewId}, ${body})`;

  it("accepte une note avec du contenu", async () => {
    expect(await violatedConstraint(() => insertNote("Le patch a tout changé."))).toBeNull();
  });

  it("REFUSE une note vide", async () => {
    expect(await violatedConstraint(() => insertNote(""))).toBe(
      "review_update_note_body_not_blank",
    );
  });

  it("REFUSE une note faite d'espaces", async () => {
    // `trim` dans la contrainte : trois espaces sont aussi vides qu'une chaîne vide, et
    // s'afficheraient comme une section datée sans contenu.
    expect(await violatedConstraint(() => insertNote("   \n  "))).toBe(
      "review_update_note_body_not_blank",
    );
  });
});

describe("Catalogue — dédoublonnage des jeux (FR-11)", () => {
  it("REFUSE un titre identique à la casse près", async () => {
    // Sans l'index unique sur `lower(title)`, « Valheim » et « valheim » créeraient deux
    // fiches et le catalogue se dédoublerait dès la première semaine.
    expect(
      await violatedConstraint(
        () => sql`insert into jvcritique_game (title) values (${`jeu ${run}`.toUpperCase()})`,
      ),
    ).toBe("game_title_lower_idx");
  });
});
