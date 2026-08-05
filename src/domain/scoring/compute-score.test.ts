import { describe, expect, it } from "vitest";

import type { DomainKey, DomainScores, Weighting } from "../types";
import { computeScore } from "./compute-score";

// --- Aides de lecture ------------------------------------------------------------

const rated = (value: number) => ({ kind: "rated" as const, value });
const empty = { kind: "empty" as const };
const notApplicable = { kind: "notApplicable" as const };

/** Pondération uniforme sur les sept Domaines. */
const evenWeighting: Weighting = {
  gameplay: 50,
  story: 50,
  atmosphere: 50,
  artDirection: 50,
  soundtrack: 50,
  pacing: 50,
  technical: 50,
};

// ---------------------------------------------------------------------------------
// Ces tests encodent des DÉCISIONS. Si l'un casse, ce n'est pas un détail
// d'implémentation qui a bougé : c'est une règle du produit qui a changé, et il faut
// vérifier que c'était voulu avant de le « réparer ».
// ---------------------------------------------------------------------------------

describe("computeScore — les trois modes d'obtention", () => {
  it("rend `weighted` quand au moins un Domaine est noté et porte un poids", () => {
    const scores: DomainScores = { gameplay: rated(16), story: rated(12) };

    const outcome = computeScore(scores, evenWeighting);

    expect(outcome.mode).toBe("weighted");
    expect(outcome).toMatchObject({ score: 14 });
  });

  it("rend `none` — et AUCUNE note — quand aucun Domaine n'est noté", () => {
    const scores: DomainScores = {
      gameplay: empty,
      story: notApplicable,
    };

    const outcome = computeScore(scores, evenWeighting);

    expect(outcome.mode).toBe("none");
    expect(outcome.domainsUsed).toEqual([]);
    // Le mode `none` ne porte pas de champ `score` : c'est le type qui empêche
    // d'afficher une note inexistante, pas une vérification à l'exécution.
    expect(outcome).not.toHaveProperty("score");
  });

  it("rend `simpleMean` ÉTIQUETÉ quand la somme des poids applicables est nulle", () => {
    // Le cas du lecteur dont aucun critère n'est couvert par l'avis : il ne pondère que
    // la bande-son et la technique, l'auteur n'a noté que le gameplay et l'histoire.
    const scores: DomainScores = { gameplay: rated(20), story: rated(10) };
    const weighting: Weighting = { soundtrack: 100, technical: 100 };

    const outcome = computeScore(scores, weighting);

    expect(outcome.mode).toBe("simpleMean");
    expect(outcome).toMatchObject({ score: 15 });
    // Une note de repli n'est jamais présentée comme une note personnalisée : c'est le
    // mode rendu ici qui permet à l'affichage de le dire.
  });
});

describe("computeScore — renormalisation sur les Domaines applicables", () => {
  it("REDISTRIBUE les poids des Domaines non notés au lieu de les compter comme des zéros", () => {
    // LE test décisif du moteur.
    //
    // gameplay 20 (poids 100), histoire 10 (poids 100), ambiance « pas évaluable »
    // (poids 100).
    //
    //   Attendu — renormalisé sur les notés :  (20×100 + 10×100) / 200        = 15
    //   Bogue classique — « pas évaluable » = 0 : (20×100 + 10×100 + 0×100) / 300 = 10
    //
    // L'écart entre 15 et 10 est exactement la différence entre « ce Domaine ne compte
    // pas » et « ce Domaine vaut zéro ».
    const scores: DomainScores = {
      gameplay: rated(20),
      story: rated(10),
      atmosphere: notApplicable,
    };
    const weighting: Weighting = {
      gameplay: 100,
      story: 100,
      atmosphere: 100,
    };

    const outcome = computeScore(scores, weighting);

    expect(outcome).toMatchObject({ mode: "weighted", score: 15 });
  });

  it("accepte une note aberrante : un seul Domaine à 20, tout le reste sans objet", () => {
    // Décision explicite de Victor, contre une proposition d'y opposer un seuil :
    // « même en n'ayant noté que l'histoire et mis 20, on accepte la note ».
    // Aucune validation de cohérence. La comparabilité se traite à l'affichage.
    const scores: DomainScores = {
      gameplay: notApplicable,
      story: rated(20),
      atmosphere: notApplicable,
      artDirection: notApplicable,
      soundtrack: notApplicable,
      pacing: notApplicable,
      technical: notApplicable,
    };
    // L'histoire est le Domaine auquel le lecteur accorde le MOINS d'importance : le
    // poids ne dilue rien, puisqu'il est seul à entrer dans la somme.
    const weighting: Weighting = {
      gameplay: 100,
      story: 10,
      atmosphere: 100,
      artDirection: 100,
      soundtrack: 100,
      pacing: 100,
      technical: 100,
    };

    const outcome = computeScore(scores, weighting);

    expect(outcome).toMatchObject({ mode: "weighted", score: 20 });
    expect(outcome.domainsUsed).toEqual(["story"]);
  });

  it("pondère réellement : un poids double vaut une contribution double", () => {
    const scores: DomainScores = { gameplay: rated(20), story: rated(10) };
    const weighting: Weighting = { gameplay: 100, story: 50 };

    // (20×100 + 10×50) / 150 = 2500 / 150 = 16.666… → 16.7
    const outcome = computeScore(scores, weighting);

    expect(outcome).toMatchObject({ mode: "weighted", score: 16.7 });
  });
});

describe("computeScore — les trois états d'une Note de domaine", () => {
  it("traite `empty` et `notApplicable` À L'IDENTIQUE dans le calcul", () => {
    const weighting: Weighting = { gameplay: 100, story: 100, atmosphere: 100 };

    const withEmpty = computeScore(
      { gameplay: rated(20), story: rated(10), atmosphere: empty },
      weighting,
    );
    const withNotApplicable = computeScore(
      { gameplay: rated(20), story: rated(10), atmosphere: notApplicable },
      weighting,
    );

    // L'arithmétique ne les distingue pas. La distinction sert l'affichage, et doit
    // survivre en base pour la Synthèse par domaine (FR-24).
    expect(withEmpty).toEqual(withNotApplicable);
  });

  it("compte un zéro comme un JUGEMENT SÉVÈRE, pas comme une absence", () => {
    const weighting: Weighting = { gameplay: 100, story: 100 };

    const withZero = computeScore(
      { gameplay: rated(0), story: rated(20) },
      weighting,
    );
    const withEmpty = computeScore(
      { gameplay: empty, story: rated(20) },
      weighting,
    );

    // Zéro participe : (0 + 20) / 2 = 10.
    expect(withZero).toMatchObject({ score: 10 });
    // Vide ne participe pas : la note est celle du seul Domaine noté.
    expect(withEmpty).toMatchObject({ score: 20 });
    // C'est précisément pour cet écart que l'interface signale l'existence de la case
    // « pas évaluable » au premier curseur amené à zéro.
  });

  it("traite un Domaine absent de l'objet comme `empty`", () => {
    const outcome = computeScore({ story: rated(14) }, { story: 100 });

    expect(outcome).toMatchObject({ mode: "weighted", score: 14 });
    expect(outcome.domainsUsed).toEqual(["story"]);
  });
});

describe("computeScore — échantillon et arrondi", () => {
  it("rend TOUJOURS les Domaines utilisés, dans l'ordre du glossaire", () => {
    // INV-5 : une note ne s'affiche jamais sans son échantillon. Le type le rend
    // disponible partout où la note l'est.
    const scores: DomainScores = {
      technical: rated(10),
      gameplay: rated(10),
      soundtrack: rated(10),
    };

    const outcome = computeScore(scores, evenWeighting);

    // L'ordre suit DOMAIN_KEYS, pas l'ordre de construction de l'objet.
    const expected: DomainKey[] = ["gameplay", "soundtrack", "technical"];
    expect(outcome.domainsUsed).toEqual(expected);
  });

  it("arrondit à une seule décimale", () => {
    // (20 + 20 + 19) / 3 = 19.666… → 19.7
    const outcome = computeScore(
      { gameplay: rated(20), story: rated(20), atmosphere: rated(19) },
      { gameplay: 100, story: 100, atmosphere: 100 },
    );

    expect(outcome).toMatchObject({ score: 19.7 });
  });

  it("garde les bornes : 0 partout donne 0, 20 partout donne 20", () => {
    const allSame = (value: number): DomainScores => ({
      gameplay: rated(value),
      story: rated(value),
      atmosphere: rated(value),
      artDirection: rated(value),
      soundtrack: rated(value),
      pacing: rated(value),
      technical: rated(value),
    });

    expect(computeScore(allSame(0), evenWeighting)).toMatchObject({ score: 0 });
    expect(computeScore(allSame(20), evenWeighting)).toMatchObject({ score: 20 });
  });
});

describe("computeScore — robustesse des entrées", () => {
  it("traite un poids négatif comme nul plutôt que de le soustraire", () => {
    // Une donnée corrompue ne doit pas produire une note hors de [0, 20].
    const outcome = computeScore(
      { gameplay: rated(20), story: rated(10) },
      { gameplay: 100, story: -100 },
    );

    // L'histoire ne compte pas : la note est celle du gameplay seul.
    expect(outcome).toMatchObject({ mode: "weighted", score: 20 });
  });

  it("bascule sur la moyenne simple si TOUS les poids sont négatifs ou nuls", () => {
    const outcome = computeScore(
      { gameplay: rated(20), story: rated(10) },
      { gameplay: -1, story: 0 },
    );

    expect(outcome).toMatchObject({ mode: "simpleMean", score: 15 });
  });

  it("fonctionne sans aucune Pondération enregistrée", () => {
    // Un lecteur authentifié qui n'a jamais réglé sa Pondération.
    const outcome = computeScore(
      { gameplay: rated(18), story: rated(12) },
      {},
    );

    expect(outcome).toMatchObject({ mode: "simpleMean", score: 15 });
  });
});
