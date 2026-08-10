import { describe, expect, it } from "vitest";

import { comparable } from "~/domain/comparable";

/**
 * La seule partie non triviale de la recherche : rendre deux titres comparables.
 *
 * C'est LE défaut courant d'une recherche en français. Chercher « pokemon » sans trouver
 * « Pokémon » ne se lit pas comme un bug — ça se lit comme « le jeu n'est pas au catalogue »,
 * et la conséquence est un doublon publié.
 */
describe("comparable", () => {
  it("ignore les accents", () => {
    expect(comparable("Pokémon")).toBe(comparable("pokemon"));
    expect(comparable("Sifù")).toBe(comparable("sifu"));
  });

  it("ignore la casse", () => {
    expect(comparable("HOLLOW KNIGHT")).toBe(comparable("hollow knight"));
  });

  it("ignore une majuscule ACCENTUÉE, que `toLowerCase` seul ne suffit pas à rapprocher", () => {
    expect(comparable("ÉLEX")).toBe(comparable("elex"));
  });

  it("garde ce qui distingue deux titres", () => {
    expect(comparable("Portal 2")).not.toBe(comparable("Portal"));
  });
});
