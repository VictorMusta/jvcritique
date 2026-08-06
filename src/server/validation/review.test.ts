import { describe, expect, it } from "vitest";

import { domainScoreInputSchema, reviewInputSchema } from "./review";

const base = {
  gameTitle: "Valheim",
  steamUrl: null,
  overallScoreManual: null,
  isPrivate: false,
  playtimeHours: null,
  completed: false,
  whyRecommend: null,
  whatMissed: null,
  whatHated: null,
  whyNotRecommend: null,
  domainScores: [{ domain: "gameplay", value: 16, notApplicable: false }],
};

describe("domainScoreInputSchema — exclusivité des trois états", () => {
  it("accepte une note", () => {
    expect(
      domainScoreInputSchema.safeParse({
        domain: "gameplay",
        value: 16,
        notApplicable: false,
      }).success,
    ).toBe(true);
  });

  it("accepte zéro — jugement sévère, pas absence", () => {
    expect(
      domainScoreInputSchema.safeParse({
        domain: "gameplay",
        value: 0,
        notApplicable: false,
      }).success,
    ).toBe(true);
  });

  it("accepte « pas évaluable » sans note", () => {
    expect(
      domainScoreInputSchema.safeParse({
        domain: "story",
        value: null,
        notApplicable: true,
      }).success,
    ).toBe(true);
  });

  it("refuse « pas évaluable » AVEC une note", () => {
    expect(
      domainScoreInputSchema.safeParse({
        domain: "story",
        value: 12,
        notApplicable: true,
      }).success,
    ).toBe(false);
  });

  it("refuse une entrée qui n'affirme rien", () => {
    // Le même état que la base refuse par CHECK. Vérifié ici aussi pour que l'utilisateur
    // reçoive un message et non une erreur générique.
    expect(
      domainScoreInputSchema.safeParse({
        domain: "story",
        value: null,
        notApplicable: false,
      }).success,
    ).toBe(false);
  });

  it("refuse une note hors bornes", () => {
    expect(
      domainScoreInputSchema.safeParse({
        domain: "story",
        value: 21,
        notApplicable: false,
      }).success,
    ).toBe(false);
  });
});

describe("reviewInputSchema — il faut au moins une note", () => {
  it("accepte un avis éclair : note globale seule, aucun domaine (FR-3)", () => {
    const result = reviewInputSchema.safeParse({
      ...base,
      overallScoreManual: 15,
      domainScores: [],
    });

    expect(result.success).toBe(true);
  });

  it("accepte un avis sans note globale mais avec un domaine noté (FR-5)", () => {
    expect(reviewInputSchema.safeParse(base).success).toBe(true);
  });

  it("REFUSE un avis sans aucune note", () => {
    // Ni saisie manuelle, ni domaine noté : le moteur rendrait le mode `none` et l'avis
    // s'afficherait muet. FR-3 et FR-5 pris ensemble laissaient cette faille.
    const result = reviewInputSchema.safeParse({
      ...base,
      overallScoreManual: null,
      domainScores: [],
    });

    expect(result.success).toBe(false);
  });

  it("REFUSE un avis dont tous les domaines sont « pas évaluable » et sans note globale", () => {
    const result = reviewInputSchema.safeParse({
      ...base,
      overallScoreManual: null,
      domainScores: [
        { domain: "gameplay", value: null, notApplicable: true },
        { domain: "story", value: null, notApplicable: true },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepte la note aberrante : un domaine à 20, le reste sans objet (INV-7)", () => {
    // Aucune validation de cohérence. On n'exige aucune vraisemblance, seulement qu'une
    // note existe.
    const result = reviewInputSchema.safeParse({
      ...base,
      overallScoreManual: null,
      domainScores: [
        { domain: "story", value: 20, notApplicable: false },
        { domain: "gameplay", value: null, notApplicable: true },
        { domain: "technical", value: null, notApplicable: true },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("reviewInputSchema — champs et normalisation", () => {
  it("transforme un texte vide ou blanc en null", () => {
    const result = reviewInputSchema.safeParse({
      ...base,
      whyRecommend: "   ",
      whatMissed: "",
      whatHated: "  Le pilotage.  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Une chaîne vide en base serait indistinguable d'un champ rempli puis effacé, et
      // s'afficherait comme une section argumentée sans contenu.
      expect(result.data.whyRecommend).toBeNull();
      expect(result.data.whatMissed).toBeNull();
      expect(result.data.whatHated).toBe("Le pilotage.");
    }
  });

  it("refuse un titre de jeu vide", () => {
    expect(
      reviewInputSchema.safeParse({ ...base, gameTitle: "   " }).success,
    ).toBe(false);
  });

  it("refuse un lien Steam qui n'est pas une URL", () => {
    expect(
      reviewInputSchema.safeParse({ ...base, steamUrl: "pas une url" }).success,
    ).toBe(false);
  });

  it("accepte un lien Steam absent ou vide", () => {
    expect(reviewInputSchema.safeParse({ ...base, steamUrl: "" }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ...base, steamUrl: null }).success).toBe(true);
  });

  it("refuse un temps de jeu négatif, accepte l'absence", () => {
    expect(
      reviewInputSchema.safeParse({ ...base, playtimeHours: -1 }).success,
    ).toBe(false);
    expect(
      reviewInputSchema.safeParse({ ...base, playtimeHours: null }).success,
    ).toBe(true);
  });

  it("n'impose aucune borne haute au temps de jeu (FR-22)", () => {
    expect(
      reviewInputSchema.safeParse({ ...base, playtimeHours: 4000 }).success,
    ).toBe(true);
  });

  it("exige que la confidentialité soit dite explicitement (FR-17)", () => {
    // `isPrivate` n'a pas de valeur par défaut dans le schéma, volontairement : un avis
    // publié est lisible par n'importe qui, y compris sans compte. Laisser le champ optionnel
    // rendrait « public » le résultat d'un oubli plutôt que d'un choix.
    const { isPrivate: _omitted, ...withoutFlag } = base;

    expect(reviewInputSchema.safeParse(withoutFlag).success).toBe(false);
  });

  it("accepte un avis privé comme un avis public", () => {
    expect(reviewInputSchema.safeParse({ ...base, isPrivate: true }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ...base, isPrivate: false }).success).toBe(true);
  });

  it("refuse le même domaine deux fois", () => {
    const result = reviewInputSchema.safeParse({
      ...base,
      domainScores: [
        { domain: "gameplay", value: 10, notApplicable: false },
        { domain: "gameplay", value: 20, notApplicable: false },
      ],
    });

    expect(result.success).toBe(false);
  });
});
