import { describe, expect, it } from "vitest";

import type { DomainScores, Weighting } from "../types";
import { presentAuthorScore, presentReaderScore } from "./present-score";

const rated = (value: number) => ({ kind: "rated" as const, value });

const domainScores: DomainScores = {
  gameplay: rated(18),
  story: rated(8),
};

const victorWeighting: Weighting = { gameplay: 100, story: 20 };
const paulWeighting: Weighting = { gameplay: 20, story: 100 };

describe("presentAuthorScore", () => {
  it("rend la saisie manuelle telle quelle, en le disant", () => {
    const score = presentAuthorScore({
      authorName: "Victor",
      overallScoreManual: 14,
      domainScores,
      authorWeighting: victorWeighting,
    });

    expect(score).toEqual({
      ownerName: "Victor",
      value: 14,
      provenance: "Note donnée à la main.",
    });
  });

  it("calcule depuis la pondération de l'auteur quand il n'y a pas de saisie", () => {
    const score = presentAuthorScore({
      authorName: "Victor",
      overallScoreManual: null,
      domainScores,
      authorWeighting: victorWeighting,
    });

    // (18×100 + 8×20) / 120 = 1960 / 120 = 16.333… → 16.3
    expect(score?.value).toBe(16.3);
    // INV-5 : l'échantillon est annoncé.
    expect(score?.provenance).toContain("2");
  });

  it("rend null quand il n'y a ni saisie ni domaine noté", () => {
    // La V0 empêche cet état à la saisie, mais le représenter évite d'afficher NaN si une
    // donnée ancienne ou importée y arrivait.
    const score = presentAuthorScore({
      authorName: "Victor",
      overallScoreManual: null,
      domainScores: {},
      authorWeighting: victorWeighting,
    });

    expect(score).toBeNull();
  });
});

describe("presentReaderScore — les trois absences légitimes (FR-15)", () => {
  it("rend null pour un lecteur non authentifié", () => {
    expect(presentReaderScore({ domainScores }, null, paulWeighting)).toBeNull();
  });

  it("rend null pour un lecteur sans pondération réglée", () => {
    // Une pondération vide signifie « pas encore réglée », pas « tous les poids à zéro ».
    // Confondre les deux afficherait une moyenne simple étiquetée « tes critères ne sont
    // pas couverts » à quelqu'un qui n'a jamais rien réglé — un message trompeur.
    expect(presentReaderScore({ domainScores }, "Paul", {})).toBeNull();
  });

  it("rend null pour un avis sans aucune note de domaine", () => {
    expect(presentReaderScore({ domainScores: {} }, "Paul", paulWeighting)).toBeNull();
  });
});

describe("presentReaderScore — la promesse du produit", () => {
  it("donne DEUX notes différentes sur le même avis selon le lecteur", () => {
    // LE test qui vérifie la raison d'être de jvcritiqué. Même avis, deux personnes :
    // Victor pèse le gameplay, Paul pèse l'histoire. L'avis doit leur parler différemment.
    const victor = presentReaderScore({ domainScores }, "Victor", victorWeighting);
    const paul = presentReaderScore({ domainScores }, "Paul", paulWeighting);

    // Victor : (1800 + 160) / 120 = 16.333… → 16.3
    // Paul    : (360 + 800) / 120  = 9.666…  → 9.7
    expect(victor?.value).toBe(16.3);
    expect(paul?.value).toBe(9.7);
    expect(victor?.value).not.toBe(paul?.value);
  });

  it("recalcule même quand l'auteur a saisi sa note à la main", () => {
    // Les deux chiffres répondent à deux questions différentes : « quel verdict rend
    // l'auteur » et « que valent ses observations selon mes critères ». Le second reste
    // calculable quand le premier est arbitraire.
    const author = presentAuthorScore({
      authorName: "Victor",
      overallScoreManual: 20,
      domainScores,
      authorWeighting: victorWeighting,
    });
    const reader = presentReaderScore({ domainScores }, "Paul", paulWeighting);

    expect(author?.value).toBe(20);
    expect(reader?.value).toBe(9.7);
  });

  it("étiquette le repli quand les critères du lecteur ne sont pas couverts", () => {
    const reader = presentReaderScore({ domainScores }, "Paul", {
      soundtrack: 100,
      technical: 100,
    });

    // Moyenne simple de 18 et 8, et le message doit le dire.
    expect(reader?.value).toBe(13);
    expect(reader?.provenance).toContain("Moyenne simple");
  });

  it("porte toujours le nom de son propriétaire", () => {
    // INV-5. La note relue n'est jamais présentée comme celle de l'auteur.
    const reader = presentReaderScore({ domainScores }, "Paul", paulWeighting);

    expect(reader?.ownerName).toBe("Paul");
  });
});
