import { describe, expect, it } from "vitest";

import { appliquerFiltre, filtreValide } from "./filtres-avis";

/**
 * Les filtres du profil, et surtout leur ORDRE.
 *
 * « Ses bangers » répond à « qu'est-ce qu'il a le plus aimé » : le plus aimé doit se lire en
 * premier. Un tri chronologique obligerait à parcourir la liste pour trouver ce qu'on est venu
 * chercher.
 */

type Cas = {
  domainScores: Record<string, never>;
  authorWeighting: Record<string, never>;
  playtimeHours: number | null;
  completed: boolean;
};

const base: Cas = {
  domainScores: {},
  authorWeighting: {},
  playtimeHours: null,
  completed: false,
};

const avis = (note: number | null, reste: Partial<Cas> = {}) => ({
  ...base,
  ...reste,
  overallScoreManual: note,
});

describe("appliquerFiltre — bangers", () => {
  it("ne garde que 17 et au-dessus, du meilleur au moins bon", () => {
    const r = appliquerFiltre(
      [avis(18), avis(12), avis(20), avis(17), avis(null)],
      "bangers",
    );

    expect(r.map((a) => a.overallScoreManual)).toEqual([20, 18, 17]);
  });
});

describe("appliquerFiltre — désastres", () => {
  it("ne garde que 8 et en dessous, du pire au moins pire", () => {
    const r = appliquerFiltre([avis(8), avis(2), avis(14), avis(6)], "desastres");

    expect(r.map((a) => a.overallScoreManual)).toEqual([2, 6, 8]);
  });

  it("garde zéro, qui est une note et non une absence", () => {
    const r = appliquerFiltre([avis(0), avis(19)], "desastres");

    expect(r.map((a) => a.overallScoreManual)).toEqual([0]);
  });
});

describe("appliquerFiltre — les autres", () => {
  it("« tous » ne réordonne rien", () => {
    const r = appliquerFiltre([avis(3), avis(19), avis(11)], "tous");

    expect(r.map((a) => a.overallScoreManual)).toEqual([3, 19, 11]);
  });

  it("« terminés » ne garde que les jeux finis", () => {
    const r = appliquerFiltre(
      [avis(15, { completed: true }), avis(15), avis(2, { completed: true })],
      "termines",
    );

    expect(r).toHaveLength(2);
  });

  it("« les plus longs » garde les avis sans temps de jeu, à la fin", () => {
    // Les écarter reviendrait à dire « ce jeu ne compte pas », alors que l'auteur a seulement
    // omis un champ facultatif.
    const r = appliquerFiltre(
      [avis(10, { playtimeHours: 12 }), avis(10), avis(10, { playtimeHours: 90 })],
      "longues",
    );

    expect(r.map((a) => a.playtimeHours)).toEqual([90, 12, null]);
  });
});

describe("filtreValide", () => {
  it("retombe sur « tous » plutôt que de ne rien afficher", () => {
    // Un lien tronqué ne doit pas donner une page vide, qui se lirait comme « cette personne
    // n'a rien écrit ».
    expect(filtreValide("nawak")).toBe("tous");
    expect(filtreValide(undefined)).toBe("tous");
    expect(filtreValide("bangers")).toBe("bangers");
  });
});
