import { describe, expect, it } from "vitest";

import { ecrireMention, extraireMentions, parseMentions } from "./mentions";

const A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const B = "aaaaaaaa-1111-4222-8333-444444444444";

/**
 * Le découpage ne doit RIEN perdre. Une mention qui ne se transforme pas est un défaut
 * d'allure ; un mot avalé par le découpage est une altération de ce que quelqu'un a écrit.
 */
function recomposer(texte: string): string {
  return parseMentions(texte)
    .map((p) => (p.kind === "texte" ? p.text : ecrireMention(p.gameId)))
    .join("");
}

describe("parseMentions — rien ne se perd", () => {
  it("rend le texte intact quand il n'y a pas de mention", () => {
    expect(parseMentions("Juste du texte.")).toEqual([
      { kind: "texte", text: "Juste du texte." },
    ]);
  });

  it("isole une mention au milieu d'une phrase", () => {
    expect(parseMentions(`Comme dans ${ecrireMention(A)} tiens.`)).toEqual([
      { kind: "texte", text: "Comme dans " },
      { kind: "mention", gameId: A },
      { kind: "texte", text: " tiens." },
    ]);
  });

  it("gère une mention en tout début et en toute fin", () => {
    expect(parseMentions(`${ecrireMention(A)} au début`)[0]).toEqual({
      kind: "mention",
      gameId: A,
    });
    const fin = parseMentions(`à la fin ${ecrireMention(B)}`);
    expect(fin[fin.length - 1]).toEqual({ kind: "mention", gameId: B });
  });

  it("gère deux mentions collées, sans texte entre elles", () => {
    expect(parseMentions(`${ecrireMention(A)}${ecrireMention(B)}`)).toEqual([
      { kind: "mention", gameId: A },
      { kind: "mention", gameId: B },
    ]);
  });

  it("recompose à l'identique, dans tous les cas", () => {
    for (const cas of [
      "",
      "rien",
      `${ecrireMention(A)}`,
      `avant ${ecrireMention(A)} après`,
      `${ecrireMention(A)} et ${ecrireMention(B)} et ${ecrireMention(A)}`,
      `@[pas-un-identifiant] reste du texte`,
    ]) {
      expect(recomposer(cas), cas).toBe(cas);
    }
  });
});

describe("parseMentions — ce qui n'est PAS une mention", () => {
  it("laisse un identifiant mal formé en texte", () => {
    // Une grammaire qui capture plus que ce qu'elle sait résoudre produit des liens morts.
    expect(parseMentions("@[coucou]")).toEqual([
      { kind: "texte", text: "@[coucou]" },
    ]);
  });

  it("laisse une arobase seule tranquille", () => {
    expect(parseMentions("@everyone et @Victor")).toEqual([
      { kind: "texte", text: "@everyone et @Victor" },
    ]);
  });

  it("accepte les majuscules mais normalise l'identifiant", () => {
    const parties = parseMentions(`@[${A.toUpperCase()}]`);
    expect(parties).toEqual([{ kind: "mention", gameId: A }]);
  });
});

describe("extraireMentions", () => {
  it("dédoublonne, et ignore les textes absents", () => {
    expect(
      extraireMentions([
        `un ${ecrireMention(A)}`,
        null,
        `deux ${ecrireMention(A)} et ${ecrireMention(B)}`,
      ]).sort(),
    ).toEqual([A, B].sort());
  });

  it("ne dépend pas de l'état interne de l'expression régulière", () => {
    // Le drapeau global rend `exec` dépendant d'un curseur partagé entre appels. Deux appels
    // identiques doivent donner le même résultat, sans quoi le second raterait des mentions.
    const texte = `${ecrireMention(A)} puis ${ecrireMention(B)}`;
    expect(extraireMentions([texte])).toEqual(extraireMentions([texte]));
    expect(parseMentions(texte)).toEqual(parseMentions(texte));
  });
});
