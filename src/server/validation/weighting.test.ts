import { describe, expect, it } from "vitest";

import { computeScore } from "~/domain/scoring/compute-score";
import { toWeighting, weightingInputSchema } from "./weighting";

describe("weightingInputSchema", () => {
  it("accepte une pondération partielle", () => {
    // Un Domaine absent vaut « pas encore réglé ». Rien n'oblige à en pondérer sept.
    const result = weightingInputSchema.safeParse([
      { domain: "gameplay", weight: 100 },
      { domain: "story", weight: 20 },
    ]);

    expect(result.success).toBe(true);
  });

  it("accepte les bornes 0 et 100", () => {
    expect(
      weightingInputSchema.safeParse([
        { domain: "gameplay", weight: 0 },
        { domain: "story", weight: 100 },
      ]).success,
    ).toBe(true);
  });

  it("accepte une liste vide", () => {
    expect(weightingInputSchema.safeParse([]).success).toBe(true);
  });

  it("refuse un poids hors bornes", () => {
    expect(
      weightingInputSchema.safeParse([{ domain: "gameplay", weight: 101 }]).success,
    ).toBe(false);
    expect(
      weightingInputSchema.safeParse([{ domain: "gameplay", weight: -1 }]).success,
    ).toBe(false);
  });

  it("refuse un poids non entier", () => {
    expect(
      weightingInputSchema.safeParse([{ domain: "gameplay", weight: 12.5 }]).success,
    ).toBe(false);
  });

  it("refuse un domaine absent du glossaire", () => {
    expect(
      weightingInputSchema.safeParse([{ domain: "graphismes", weight: 50 }]).success,
    ).toBe(false);
  });

  it("refuse le même domaine deux fois", () => {
    // Sans cette règle, la seconde valeur écraserait la première en silence.
    const result = weightingInputSchema.safeParse([
      { domain: "gameplay", weight: 10 },
      { domain: "gameplay", weight: 90 },
    ]);

    expect(result.success).toBe(false);
  });

  it("refuse plus d'entrées qu'il n'existe de domaines", () => {
    const tooMany = Array.from({ length: 8 }, () => ({
      domain: "gameplay" as const,
      weight: 10,
    }));

    expect(weightingInputSchema.safeParse(tooMany).success).toBe(false);
  });
});

describe("toWeighting — jonction avec le moteur de notation", () => {
  it("produit une pondération que computeScore consomme directement", () => {
    // Ce test existe pour verrouiller la jonction entre le bord de l'application et le
    // domaine. Une divergence de forme entre les deux ne se verrait qu'à l'exécution.
    const entries = weightingInputSchema.parse([
      { domain: "gameplay", weight: 100 },
      { domain: "story", weight: 50 },
    ]);

    const outcome = computeScore(
      { gameplay: { kind: "rated", value: 20 }, story: { kind: "rated", value: 10 } },
      toWeighting(entries),
    );

    // (20×100 + 10×50) / 150 = 16.666… → 16.7
    expect(outcome).toMatchObject({ mode: "weighted", score: 16.7 });
  });

  it("rend un objet vide pour une liste vide, ce qui fait retomber sur la moyenne simple", () => {
    const outcome = computeScore(
      { gameplay: { kind: "rated", value: 18 }, story: { kind: "rated", value: 12 } },
      toWeighting([]),
    );

    expect(outcome).toMatchObject({ mode: "simpleMean", score: 15 });
  });
});
