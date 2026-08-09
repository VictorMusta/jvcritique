import { describe, expect, it } from "vitest";

import { expliquerEchec, reviewInputSchema } from "./review";

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
    // LE cas de Leny : une note personnalisée à virgule.
    expect(refus({ overallScoreManual: 16.5 })).toContain("nombre entier");
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
