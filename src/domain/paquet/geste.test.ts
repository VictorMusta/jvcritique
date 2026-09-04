import { describe, expect, it } from "vitest";

import { GESTES, gestePourTouche, LIBELLES_GESTE, resoudreGeste, SEUIL_GESTE } from "./geste";

describe("resoudreGeste", () => {
  it("ne reconnaît rien sous le seuil, sur aucun axe", () => {
    expect(resoudreGeste(0, 0)).toBeNull();
    expect(resoudreGeste(SEUIL_GESTE - 1, 0)).toBeNull();
    expect(resoudreGeste(0, -(SEUIL_GESTE - 1))).toBeNull();
    expect(resoudreGeste(60, 60)).toBeNull();
  });

  it("reconnaît un geste dès le seuil, exactement", () => {
    expect(resoudreGeste(SEUIL_GESTE, 0)).toBe("aime");
    expect(resoudreGeste(-SEUIL_GESTE, 0)).toBe("pas_pour_moi");
    expect(resoudreGeste(0, -SEUIL_GESTE)).toBe("souhait");
    expect(resoudreGeste(0, SEUIL_GESTE)).toBe("passer");
  });

  it("laisse l'axe dominant l'emporter sur un balayage de travers", () => {
    // Un « j'aime » lancé un peu vers le bas reste un « j'aime ».
    expect(resoudreGeste(140, 50)).toBe("aime");
    // Un « à souhaiter » un peu vers la gauche reste un « à souhaiter ».
    expect(resoudreGeste(-40, -150)).toBe("souhait");
  });

  it("donne l'horizontal à égalité stricte", () => {
    expect(resoudreGeste(120, 120)).toBe("aime");
    expect(resoudreGeste(-120, 120)).toBe("pas_pour_moi");
  });

  it("accepte un seuil différent", () => {
    expect(resoudreGeste(30, 0, 20)).toBe("aime");
    expect(resoudreGeste(30, 0, 40)).toBeNull();
  });
});

describe("libellés et touches", () => {
  it("donne à chaque geste un tampon, un bouton et une touche distincts", () => {
    const tampons = new Set(GESTES.map((g) => LIBELLES_GESTE[g].tampon));
    const touches = new Set(GESTES.map((g) => LIBELLES_GESTE[g].touche));
    expect(tampons.size).toBe(GESTES.length);
    expect(touches.size).toBe(GESTES.length);
  });

  it("retrouve le geste d'une touche, et rien pour les autres", () => {
    expect(gestePourTouche("ArrowRight")).toBe("aime");
    expect(gestePourTouche("ArrowLeft")).toBe("pas_pour_moi");
    expect(gestePourTouche("ArrowUp")).toBe("souhait");
    expect(gestePourTouche("ArrowDown")).toBe("passer");
    expect(gestePourTouche("Enter")).toBeNull();
    expect(gestePourTouche("Escape")).toBeNull();
  });
});
