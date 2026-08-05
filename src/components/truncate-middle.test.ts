import { describe, expect, it } from "vitest";

import { truncateMiddle } from "./truncate-middle";

describe("truncateMiddle", () => {
  it("laisse intact un texte assez court", () => {
    expect(truncateMiddle("Victor", 10)).toBe("Victor");
    expect(truncateMiddle("Victor", 6)).toBe("Victor");
  });

  it("garde le début ET la fin", () => {
    // 10 caractères au total : 5 de tête, l'ellipse, 4 de queue.
    expect(truncateMiddle("Alexandre-Benoît", 10)).toBe("Alexa…noît");
  });

  it("reste discriminant là où une troncature par la fin ne l'est plus", () => {
    // C'est la raison d'être de cette fonction. Tronqués par la fin, ces deux noms
    // donneraient tous deux « Alexandre-B… » — or l'étiquette de propriétaire est la seule
    // distinction non chromatique entre deux notes (WCAG 1.4.1).
    const a = truncateMiddle("Alexandre-Benoît", 12);
    const b = truncateMiddle("Alexandre-Bertrand", 12);

    expect(a).not.toBe(b);
  });

  it("respecte la longueur demandée", () => {
    for (const max of [2, 3, 5, 8, 13]) {
      expect(truncateMiddle("un-nom-vraiment-tres-long", max).length).toBeLessThanOrEqual(
        max,
      );
    }
  });

  it("dégrade proprement sur les longueurs absurdes", () => {
    expect(truncateMiddle("Victor", 1)).toBe("…");
    expect(truncateMiddle("Victor", 0)).toBe("…");
    expect(truncateMiddle("", 5)).toBe("");
  });
});
