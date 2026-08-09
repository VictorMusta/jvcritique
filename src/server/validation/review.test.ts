import { describe, expect, it } from "vitest";

import {
  domainScoreInputSchema,
  expliquerEchec,
  reviewInputSchema,
} from "./review";

const base = {
  gameTitle: "Valheim",
  steamUrl: null,
  overallScoreManual: null,
  isPrivate: false,
  screenshots: [],
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

  it("accepte des captures déjà déposées", () => {
    const result = reviewInputSchema.safeParse({
      ...base,
      screenshots: [
        { storageKey: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", width: 1920, height: 1080 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("refuse une clé de stockage qui n'est pas un identifiant", () => {
    // La clé sert à composer un chemin de fichier côté serveur. Exiger la forme exacte d'un
    // UUID ferme la porte aux tentatives de remontée de dossier plutôt que de les nettoyer.
    for (const cle of ["../../etc/passwd", "abc", "", "3f2504e0-4f89-41d3-9a0c"]) {
      expect(
        reviewInputSchema.safeParse({
          ...base,
          screenshots: [{ storageKey: cle, width: 100, height: 100 }],
        }).success,
        cle,
      ).toBe(false);
    }
  });

  it("refuse des dimensions absurdes", () => {
    const cle = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

    expect(
      reviewInputSchema.safeParse({
        ...base,
        screenshots: [{ storageKey: cle, width: 0, height: 100 }],
      }).success,
    ).toBe(false);
    expect(
      reviewInputSchema.safeParse({
        ...base,
        screenshots: [{ storageKey: cle, width: -5, height: 100 }],
      }).success,
    ).toBe(false);
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

/**
 * Ce qu'un refus DIT à celui qui écrit.
 *
 * « Il y a un souci dans ce qui a été saisi » est vrai et parfaitement inutile : Leny est
 * resté bloqué dessus sans savoir quoi changer. Un message de refus qui ne désigne pas le
 * champ transforme une correction de dix secondes en abandon.
 */

const valide = {
  gameTitle: "Outer Wilds",
  steamUrl: "",
  overallScoreManual: 18,
  isPrivate: false,
  playtimeHours: 22,
  completed: true,
  whyRecommend: "Le meilleur jeu d'exploration jamais fait.",
  whatMissed: "",
  whatHated: "",
  whyNotRecommend: "",
  domainScores: [],
  screenshots: [],
};

function refus(patch: Record<string, unknown>): string {
  const parsed = reviewInputSchema.safeParse({ ...valide, ...patch });

  if (parsed.success) {
    throw new Error("cette entrée était censée être refusée");
  }

  return expliquerEchec(parsed.error);
}

describe("expliquerEchec — le message désigne le champ", () => {
  it("nomme la note globale, avec la règle et un exemple", () => {
    // 16,5 est ACCEPTÉ depuis la décision de Victor du 9 août 2026 ; c'est le tiers de point
    // qui ne l'est pas, faute d'être affichable.
    expect(refus({ overallScoreManual: 16.3 })).toContain("demi-point");
  });

  it("ACCEPTE une note au demi-point", () => {
    // Le cas de Leny, qui était bloqué. FR-5 imposait un entier ; l'usage a tranché contre,
    // et la note calculée s'affichait déjà avec une décimale.
    const parsed = reviewInputSchema.safeParse({ ...valide, overallScoreManual: 16.5 });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.overallScoreManual).toBe(16.5);
  });

  it("refuse toujours une note hors bornes", () => {
    expect(refus({ overallScoreManual: 20.5 })).toContain("0 et 20");
    expect(refus({ overallScoreManual: -0.5 })).toContain("0 et 20");
  });

  it("nomme le temps de jeu et interdit explicitement la virgule", () => {
    expect(refus({ playtimeHours: 20.5 })).toContain("sans « h » ni virgule");
  });

  it("nomme le nom du jeu quand il manque", () => {
    expect(refus({ gameTitle: "  " })).toContain("nom du jeu");
  });

  it("rend telle quelle la phrase d'une règle croisée", () => {
    // Ces règles portent déjà un message écrit pour être lu : le réécrire le dégraderait.
    expect(refus({ overallScoreManual: null, domainScores: [] })).toContain(
      "au moins une note",
    );
  });
});

describe("le lien Steam — compléter plutôt que refuser", () => {
  it("accepte une adresse collée SANS protocole", () => {
    // C'est la forme que Steam met dans le presse-papier, et la refuser sans rien expliquer
    // n'apprenait rien à personne.
    const parsed = reviewInputSchema.safeParse({
      ...valide,
      steamUrl: "store.steampowered.com/app/753640",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.steamUrl).toBe(
      "https://store.steampowered.com/app/753640",
    );
  });

  it("laisse intacte une adresse déjà complète, et n'impose pas https à un http assumé", () => {
    const parsed = reviewInputSchema.safeParse({
      ...valide,
      steamUrl: "http://exemple.test/jeu",
    });

    expect(parsed.success && parsed.data.steamUrl).toBe("http://exemple.test/jeu");
  });

  it("garde le champ vide comme absence, et non comme adresse invalide", () => {
    const parsed = reviewInputSchema.safeParse({ ...valide, steamUrl: "   " });

    expect(parsed.success && parsed.data.steamUrl).toBeNull();
  });
});
