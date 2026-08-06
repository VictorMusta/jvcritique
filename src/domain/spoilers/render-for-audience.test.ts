import { describe, expect, it } from "vitest";

import {
  type Audience,
  audienceFor,
  excerptForAnonymous,
  renderForAudience,
} from "./render-for-audience";

describe("audienceFor", () => {
  it("un lecteur non connecté est anonyme", () => {
    expect(audienceFor(null, "victor")).toBe("anonymous");
  });

  it("l'auteur de l'avis est traité comme auteur", () => {
    expect(audienceFor("victor", "victor")).toBe("author");
  });

  it("un autre utilisateur connecté est un membre", () => {
    expect(audienceFor("paul", "victor")).toBe("member");
  });
});

const body = "La fin est terrible : ||le héros meurt|| et je m'en remets pas.";
const secret = "le héros meurt";

/**
 * Sérialise ce qui partirait réellement sur le réseau. C'est le test qui compte : R-D6 exige
 * que les tests portent sur LES OCTETS, pas sur « la fonction a bien été appelée ».
 */
const bytesSentTo = (audience: Audience) =>
  JSON.stringify(renderForAudience(body, audience));

describe("renderForAudience — la matrice audience × donnée (R-D6)", () => {
  it("AUTEUR : contenu complet, spoilers révélés", () => {
    // Il connaît son propre texte. Le masquer serait absurde.
    const segments = renderForAudience(body, "author");

    expect(segments).toEqual([
      { kind: "text", text: "La fin est terrible : " },
      { kind: "revealed", text: secret },
      { kind: "text", text: " et je m'en remets pas." },
    ]);
  });

  it("MEMBRE : contenu présent, marqué pour ne jamais être peint", () => {
    const segments = renderForAudience(body, "member");

    expect(segments).toEqual([
      { kind: "text", text: "La fin est terrible : " },
      { kind: "spoiler", text: secret },
      { kind: "text", text: " et je m'en remets pas." },
    ]);
    // Le texte EST dans les octets — c'est autorisé pour un ami authentifié. La garantie
    // « jamais peint » est structurelle côté rendu : porté par un attribut, pas par un
    // nœud de texte.
    expect(bytesSentTo("member")).toContain(secret);
  });

  it("ANONYME : le texte du spoiler est ABSENT DES OCTETS (INV-6)", () => {
    // LE test de l'invariant. Pas « la fonction a filtré », mais « la charge utile ne
    // contient pas le secret ».
    expect(bytesSentTo("anonymous")).not.toContain(secret);
    expect(bytesSentTo("anonymous")).not.toContain("héros");
  });

  it("ANONYME : le segment masqué ne porte AUCUN champ texte", () => {
    // Ce n'est pas un texte vide ni un texte protégé : le champ n'existe pas.
    // On ne peut pas fuiter ce qu'on n'a pas mis dans l'objet.
    const segments = renderForAudience(body, "anonymous");
    const redacted = segments.find((s) => s.kind === "redacted");

    expect(redacted).toEqual({ kind: "redacted" });
    expect(redacted).not.toHaveProperty("text");
  });

  it("les trois audiences voient le même texte NON masqué", () => {
    for (const audience of ["author", "member", "anonymous"] as const) {
      const visible = renderForAudience(body, audience)
        .filter((s) => s.kind === "text")
        .map((s) => s.text)
        .join("");

      expect(visible).toBe("La fin est terrible :  et je m'en remets pas.");
    }
  });

  it("un délimiteur non fermé reste du texte pour TOUTES les audiences", () => {
    // D10 : littéral. Il ne doit donc pas être retiré à l'anonyme — sinon on amputerait un
    // texte parfaitement public.
    const literal = "je préviens || et puis rien";

    for (const audience of ["author", "member", "anonymous"] as const) {
      expect(renderForAudience(literal, audience)).toEqual([
        { kind: "text", text: literal },
      ]);
    }
  });
});

describe("excerptForAnonymous — parser, retirer, PUIS tronquer", () => {
  it("ne laisse jamais fuiter le spoiler, même avec un extrait très court", () => {
    // La borne est choisie pour couper en plein milieu du spoiler si l'ordre était mauvais.
    for (const max of [10, 20, 25, 30, 40, 60, 200]) {
      expect(excerptForAnonymous(body, max)).not.toContain("héros");
      expect(excerptForAnonymous(body, max)).not.toContain("meurt");
    }
  });

  it("remplace le passage par un marqueur lisible plutôt que de l'amputer", () => {
    expect(excerptForAnonymous(body, 200)).toBe(
      "La fin est terrible : [passage masqué] et je m'en remets pas.",
    );
  });

  it("respecte la longueur demandée", () => {
    for (const max of [12, 25, 50]) {
      expect(excerptForAnonymous(body, max).length).toBeLessThanOrEqual(max);
    }
  });

  it("normalise les sauts de ligne — un aperçu tient sur une ligne", () => {
    expect(excerptForAnonymous("un\n\ndeux   trois", 200)).toBe("un deux trois");
  });

  it("ne tronque pas un texte déjà assez court", () => {
    expect(excerptForAnonymous("Court.", 200)).toBe("Court.");
  });

  it("démontre la fuite que le mauvais ordre produirait", () => {
    // Ce test documente le défaut, pour que personne ne « simplifie » en tronquant d'abord.
    const naive = body.slice(0, 40).replace(/\|\|/g, "");

    expect(naive).toContain("le héros meurt"); // fuite
    expect(excerptForAnonymous(body, 40)).not.toContain("le héros"); // pas de fuite
  });
});
