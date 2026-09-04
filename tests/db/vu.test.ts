import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/*
 * La marque « vu » (le paquet) : ce que la base garantit d'elle-même.
 *
 * Même discipline que constraints.test.ts — on teste les contraintes réelles sur un vrai
 * PostgreSQL, parce qu'un CHECK ou une clé primaire qu'on croit poser et qu'on n'a jamais vu
 * refuser une ligne n'est qu'une intention.
 */

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL est requis pour les tests d'intégration. Voir README, section Développement local.",
  );
}

const sql = postgres(url, { max: 1, onnotice: () => undefined });
const run = `test-vu-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const lecteurId = `${run}-lecteur`;
const auteurId = `${run}-auteur`;
let reviewId: string;

async function contrainteViolee(insert: () => Promise<unknown>): Promise<string | null> {
  try {
    await insert();
    return null;
  } catch (error) {
    const name = (error as { constraint_name?: string }).constraint_name;
    return name ?? "(contrainte non nommée)";
  }
}

beforeAll(async () => {
  await sql`insert into jvcritique_user (id, email, name) values
            (${lecteurId}, ${`${run}-lecteur@exemple.fr`}, 'Lecteur'),
            (${auteurId}, ${`${run}-auteur@exemple.fr`}, 'Auteur')`;
  const [game] = await sql<{ id: string }[]>`
    insert into jvcritique_game (title) values (${`Jeu ${run}`}) returning id`;
  const [review] = await sql<{ id: string }[]>`
    insert into jvcritique_review ("gameId", "authorId")
    values (${game!.id}, ${auteurId}) returning id`;
  reviewId = review!.id;
});

afterAll(async () => {
  // Les utilisateurs partent, et tout ce qui les référence part avec eux (cascade).
  await sql`delete from jvcritique_user where id in (${lecteurId}, ${auteurId})`;
  await sql`delete from jvcritique_game where title = ${`Jeu ${run}`}`;
  await sql.end();
});

describe("jvcritique_review_vu", () => {
  it("accepte une première marque", async () => {
    await sql`insert into jvcritique_review_vu ("userId", "reviewId") values (${lecteurId}, ${reviewId})`;
    const [row] = await sql<{ n: string }[]>`
      select count(*)::text as n from jvcritique_review_vu where "userId" = ${lecteurId}`;
    expect(row!.n).toBe("1");
  });

  it("refuse la même marque deux fois — c'est la clé primaire, pas le code, qui garde l'unicité", async () => {
    const violee = await contrainteViolee(
      () =>
        sql`insert into jvcritique_review_vu ("userId", "reviewId") values (${lecteurId}, ${reviewId})`,
    );
    expect(violee).toBe("jvcritique_review_vu_userId_reviewId_pk");
  });

  it("ne peut pas marquer un avis qui n'existe pas", async () => {
    const violee = await contrainteViolee(
      () =>
        sql`insert into jvcritique_review_vu ("userId", "reviewId")
            values (${lecteurId}, '00000000-0000-4000-8000-000000000000')`,
    );
    expect(violee).toBe("jvcritique_review_vu_reviewId_jvcritique_review_id_fk");
  });

  it("disparaît avec l'avis (cascade)", async () => {
    await sql`delete from jvcritique_review where id = ${reviewId}`;
    const [row] = await sql<{ n: string }[]>`
      select count(*)::text as n from jvcritique_review_vu where "reviewId" = ${reviewId}`;
    expect(row!.n).toBe("0");
  });
});
