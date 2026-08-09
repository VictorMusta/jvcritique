import { describe, expect, it } from "vitest";

import { synthetiserJeu } from "./synthese-jeu";
import type { DomainScores, Weighting } from "../types";

/**
 * La synthèse d'un Jeu — la seule note du produit qui n'appartienne à personne.
 *
 * Ce qui est éprouvé ici tient surtout à ce qu'elle NE DOIT PAS faire : compter des avis qui
 * n'ont pas de note, traiter « pas évaluable » comme un zéro, ou rendre une valeur sans dire
 * sur combien d'avis elle porte.
 */

const rien: Weighting = {};

function avis(
  domainScores: DomainScores,
  overallScoreManual: number | null = null,
  authorWeighting: Weighting = rien,
) {
  return { domainScores, overallScoreManual, authorWeighting };
}

describe("synthetiserJeu — la note globale", () => {
  it("moyenne les notes SAISIES À LA MAIN", () => {
    const s = synthetiserJeu([
      avis({}, 18),
      avis({}, 15),
    ]);

    expect(s.globale).toEqual({ valeur: 16.5, echantillon: 2 });
  });

  it("retombe sur la note calculée avec la pondération DE L'AUTEUR", () => {
    // Pas celle du lecteur : une fiche de jeu dont la moyenne changerait d'un visiteur à
    // l'autre ne voudrait plus rien dire — deux personnes ne pourraient plus en parler.
    const s = synthetiserJeu([
      avis(
        { gameplay: { kind: "rated", value: 20 }, story: { kind: "rated", value: 10 } },
        null,
        { gameplay: 100, story: 0 },
      ),
    ]);

    expect(s.globale).toEqual({ valeur: 20, echantillon: 1 });
  });

  it("EXCLUT un avis qui ne porte aucune note, et le retire de l'échantillon", () => {
    // Un avis tout en texte est parfaitement légitime. Le compter comme un zéro serait une
    // invention pure, et le compter dans l'échantillon ferait mentir le « sur N avis ».
    const s = synthetiserJeu([
      avis({}, 16),
      avis({}),
    ]);

    expect(s.globale).toEqual({ valeur: 16, echantillon: 1 });
  });

  it("rend `null` quand aucun avis ne porte de note", () => {
    expect(synthetiserJeu([avis({}), avis({})]).globale).toBeNull();
  });

  it("rend `null` sans aucun avis", () => {
    expect(synthetiserJeu([]).globale).toBeNull();
  });
});

describe("synthetiserJeu — par domaine", () => {
  it("moyenne domaine par domaine, avec l'échantillon propre à chacun", () => {
    // Les échantillons DIFFÈRENT d'un domaine à l'autre, et c'est le point : une moyenne sur
    // un seul avis ne se lit pas comme une moyenne sur trois.
    const s = synthetiserJeu([
      avis({ gameplay: { kind: "rated", value: 18 }, story: { kind: "rated", value: 12 } }),
      avis({ gameplay: { kind: "rated", value: 14 } }),
    ]);

    expect(s.parDomaine).toEqual([
      { domain: "gameplay", moyenne: { valeur: 16, echantillon: 2 } },
      { domain: "story", moyenne: { valeur: 12, echantillon: 1 } },
    ]);
  });

  it("n'inclut PAS un domaine que personne n'a noté", () => {
    // Absent, et non présent à zéro : zéro est une note légitime, l'absence n'en est pas une.
    const s = synthetiserJeu([avis({ gameplay: { kind: "rated", value: 18 } })]);

    expect(s.parDomaine.map((d) => d.domain)).toEqual(["gameplay"]);
  });

  it("écarte « pas évaluable » au lieu de le compter comme un zéro", () => {
    // Le défaut le plus tentant, et le plus faux : un jeu sans bande-son verrait sa moyenne
    // s'effondrer alors que personne n'a porté le moindre jugement négatif.
    const s = synthetiserJeu([
      avis({ soundtrack: { kind: "rated", value: 16 } }),
      avis({ soundtrack: { kind: "notApplicable" } }),
    ]);

    expect(s.parDomaine).toEqual([
      { domain: "soundtrack", moyenne: { valeur: 16, echantillon: 1 } },
    ]);
  });

  it("suit l'ordre du glossaire, pas celui de saisie", () => {
    const s = synthetiserJeu([
      avis({
        technical: { kind: "rated", value: 10 },
        gameplay: { kind: "rated", value: 10 },
      }),
    ]);

    expect(s.parDomaine.map((d) => d.domain)).toEqual(["gameplay", "technical"]);
  });

  it("arrondit au dixième, comme les notes individuelles", () => {
    const s = synthetiserJeu([
      avis({ gameplay: { kind: "rated", value: 17 } }),
      avis({ gameplay: { kind: "rated", value: 18 } }),
      avis({ gameplay: { kind: "rated", value: 18 } }),
    ]);

    expect(s.parDomaine[0]?.moyenne.valeur).toBe(17.7);
  });
});
