import { describe, expect, it } from "vitest";

import { hasSpoiler, parseSpoilers, type Segment } from "./parse-spoilers";

/**
 * La grammaire de D10 et R-D10 sous forme de TABLE entrée → sortie attendue, comme
 * l'exigeait l'amendement : chaque ligne de la spécification devient un cas paramétré,
 * plutôt qu'une prose que personne ne recoupe.
 */
const cases: ReadonlyArray<{
  readonly name: string;
  readonly input: string;
  readonly expected: Segment[];
}> = [
  {
    name: "texte sans spoiler",
    input: "Un jeu correct.",
    expected: [{ kind: "text", text: "Un jeu correct." }],
  },
  {
    name: "un spoiler seul",
    input: "||le frère meurt||",
    expected: [{ kind: "spoiler", text: "le frère meurt" }],
  },
  {
    name: "spoiler au milieu",
    input: "La fin où ||tout le monde meurt|| est mémorable.",
    expected: [
      { kind: "text", text: "La fin où " },
      { kind: "spoiler", text: "tout le monde meurt" },
      { kind: "text", text: " est mémorable." },
    ],
  },
  {
    name: "deux spoilers",
    input: "||un|| et ||deux||",
    expected: [
      { kind: "spoiler", text: "un" },
      { kind: "text", text: " et " },
      { kind: "spoiler", text: "deux" },
    ],
  },
  {
    name: "délimiteur jamais fermé : LITTÉRAL",
    input: "je dis ||attention et puis rien",
    expected: [{ kind: "text", text: "je dis ||attention et puis rien" }],
  },
  {
    name: "trois délimiteurs : le troisième est littéral",
    input: "||caché|| puis ||orphelin",
    expected: [
      { kind: "spoiler", text: "caché" },
      { kind: "text", text: " puis ||orphelin" },
    ],
  },
  {
    name: "spoiler vide : littéral, ignoré",
    input: "avant |||| après",
    expected: [{ kind: "text", text: "avant |||| après" }],
  },
  {
    name: "pas d'imbrication : le délimiteur interne ferme",
    input: "||a||b||c||",
    expected: [
      { kind: "spoiler", text: "a" },
      { kind: "text", text: "b" },
      { kind: "spoiler", text: "c" },
    ],
  },
  {
    name: "sauts de ligne autorisés dans un spoiler",
    input: "||ligne un\nligne deux||",
    expected: [{ kind: "spoiler", text: "ligne un\nligne deux" }],
  },
  {
    name: "échappement : un délimiteur littéral",
    input: "les tubes \\|| ne sont pas un spoiler",
    expected: [{ kind: "text", text: "les tubes || ne sont pas un spoiler" }],
  },
  {
    name: "échappement : antislash devant autre chose reste littéral, antislash compris",
    input: "chemin C:\\dossier",
    expected: [{ kind: "text", text: "chemin C:\\dossier" }],
  },
  {
    name: "échappement : antislash doublé puis délimiteur ouvre bien un spoiler",
    input: "\\\\||caché||",
    expected: [
      { kind: "text", text: "\\" },
      { kind: "spoiler", text: "caché" },
    ],
  },
  {
    name: "un délimiteur échappé n'ouvre pas, celui d'après si",
    input: "\\|| puis ||vrai spoiler||",
    expected: [
      { kind: "text", text: "|| puis " },
      { kind: "spoiler", text: "vrai spoiler" },
    ],
  },
  {
    name: "texte vide",
    input: "",
    expected: [],
  },
  {
    name: "une seule barre n'est pas un délimiteur",
    input: "a | b",
    expected: [{ kind: "text", text: "a | b" }],
  },
];

describe("parseSpoilers — grammaire D10 et R-D10", () => {
  for (const { name, input, expected } of cases) {
    it(name, () => {
      expect(parseSpoilers(input)).toEqual(expected);
    });
  }
});

describe("parseSpoilers — propriétés générales", () => {
  it("ne rend jamais de segment de texte vide", () => {
    for (const { input } of cases) {
      for (const segment of parseSpoilers(input)) {
        expect(segment.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("préserve tout le texte visible quand il n'y a aucun spoiler", () => {
    const input = "Rien à cacher ici, juste un | et un \\ perdus.";
    const rebuilt = parseSpoilers(input)
      .map((s) => s.text)
      .join("");

    expect(rebuilt).toBe("Rien à cacher ici, juste un | et un \\ perdus.");
  });
});

describe("hasSpoiler", () => {
  it("distingue un vrai spoiler d'un délimiteur littéral", () => {
    expect(hasSpoiler("||caché||")).toBe(true);
    expect(hasSpoiler("non fermé ||")).toBe(false);
    expect(hasSpoiler("échappé \\||")).toBe(false);
    expect(hasSpoiler("vide ||||")).toBe(false);
  });
});

describe("parseSpoilers — la propriété de sécurité de l'ordre (R-D6)", () => {
  it("montre pourquoi tronquer AVANT de parser fait fuiter le spoiler", () => {
    const body = "La fin est terrible : ||le héros meurt à la dernière minute||";

    // BON ORDRE — parser d'abord : le passage est identifié comme spoiler.
    const parsed = parseSpoilers(body);
    expect(parsed.some((s) => s.kind === "spoiler")).toBe(true);

    // MAUVAIS ORDRE — tronquer d'abord, comme le ferait un extrait Open Graph de 40
    // caractères. La fermeture est coupée, donc D10 rend le `||` littéral…
    const truncatedFirst = parseSpoilers(body.slice(0, 40));

    // …et le début du spoiler se retrouve en TEXTE CLAIR.
    expect(truncatedFirst.every((s) => s.kind === "text")).toBe(true);
    expect(truncatedFirst[0]?.text).toContain("le héros meurt");

    // C'est exactement la fuite que l'ordre « parser, retirer, puis tronquer » empêche.
    // Ce test existe pour que personne ne réinvente le mauvais ordre en optimisant.
  });
});
