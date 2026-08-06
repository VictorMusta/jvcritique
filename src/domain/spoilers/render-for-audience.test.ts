import { describe, expect, it } from "vitest";

import {
  type Audience,
  audienceFor,
  excerptFor,
  renderForAudience,
} from "./render-for-audience";

const body = "La fin est terrible : ||le héros meurt|| et je m'en remets pas.";
const secret = "le héros meurt";

/**
 * Sérialise ce qui partirait réellement sur le réseau. C'est le test qui compte : R-D6 exige
 * que les tests portent sur LES OCTETS, pas sur « la fonction a bien été appelée ».
 */
const bytesSentTo = (audience: Audience) =>
  JSON.stringify(renderForAudience(body, audience));

describe("audienceFor", () => {
  it("l'auteur de l'avis est traité comme auteur", () => {
    expect(audienceFor("victor", "victor")).toBe("author");
  });

  it("un autre utilisateur connecté est un lecteur", () => {
    expect(audienceFor("paul", "victor")).toBe("reader");
  });

  it("un visiteur non connecté est un lecteur, PAS un cas à part", () => {
    // Décision de Victor du 6 août 2026, contre la lettre de FR-16 : un spoiler se révèle au
    // clic pour tout le monde, comme sur Discord. Une personne qui clique délibérément sur un
    // passage masqué a demandé à le lire — avoir un compte n'y change rien.
    expect(audienceFor(null, "victor")).toBe("reader");
  });

  it("ne rend jamais `excerpt` — un extrait n'est pas une personne", () => {
    for (const readerId of [null, "paul", "victor"]) {
      expect(audienceFor(readerId, "victor")).not.toBe("excerpt");
    }
  });
});

describe("renderForAudience — la matrice audience × donnée", () => {
  it("AUTEUR : contenu complet, spoilers révélés", () => {
    expect(renderForAudience(body, "author")).toEqual([
      { kind: "text", text: "La fin est terrible : " },
      { kind: "revealed", text: secret },
      { kind: "text", text: " et je m'en remets pas." },
    ]);
  });

  it("LECTEUR : contenu présent, marqué pour ne jamais être peint avant révélation", () => {
    expect(renderForAudience(body, "reader")).toEqual([
      { kind: "text", text: "La fin est terrible : " },
      { kind: "spoiler", text: secret },
      { kind: "text", text: " et je m'en remets pas." },
    ]);
    // Le texte EST dans les octets — c'est ce qui permet de le révéler au clic. La garantie
    // « jamais peint » est structurelle côté rendu : aucun nœud de texte avant révélation.
    expect(bytesSentTo("reader")).toContain(secret);
  });

  it("EXTRAIT : le texte du spoiler est ABSENT DES OCTETS", () => {
    // La menace réelle : un robot fabrique un aperçu que tout un salon Discord voit sans que
    // personne n'ait cliqué. C'est le seul cas où le texte ne doit pas partir.
    expect(bytesSentTo("excerpt")).not.toContain(secret);
    expect(bytesSentTo("excerpt")).not.toContain("héros");
  });

  it("EXTRAIT : le segment masqué ne porte AUCUN champ texte", () => {
    // Ce n'est pas un texte vide ni un texte protégé : le champ n'existe pas. On ne peut pas
    // fuiter ce qu'on n'a pas mis dans l'objet.
    const redacted = renderForAudience(body, "excerpt").find(
      (s) => s.kind === "redacted",
    );

    expect(redacted).toEqual({ kind: "redacted" });
    expect(redacted).not.toHaveProperty("text");
  });

  it("les trois audiences voient le même texte NON masqué", () => {
    for (const audience of ["author", "reader", "excerpt"] as const) {
      const visible = renderForAudience(body, audience)
        .filter((s) => s.kind === "text")
        .map((s) => s.text)
        .join("");

      expect(visible).toBe("La fin est terrible :  et je m'en remets pas.");
    }
  });

  it("un délimiteur non fermé reste du texte pour TOUTES les audiences", () => {
    // D10 : littéral. Il ne doit donc pas être retiré de l'extrait — sinon on amputerait un
    // texte parfaitement public.
    const literal = "je préviens || et puis rien";

    for (const audience of ["author", "reader", "excerpt"] as const) {
      expect(renderForAudience(literal, audience)).toEqual([
        { kind: "text", text: literal },
      ]);
    }
  });
});

describe("excerptFor — parser, retirer, PUIS tronquer", () => {
  it("ne laisse jamais fuiter le spoiler, même avec un extrait très court", () => {
    // Les bornes sont choisies pour couper en plein milieu du spoiler si l'ordre était mauvais.
    for (const max of [10, 20, 25, 30, 40, 60, 200]) {
      expect(excerptFor(body, max)).not.toContain("héros");
      expect(excerptFor(body, max)).not.toContain("meurt");
    }
  });

  it("remplace le passage par un marqueur lisible plutôt que de l'amputer", () => {
    expect(excerptFor(body, 200)).toBe(
      "La fin est terrible : [passage masqué] et je m'en remets pas.",
    );
  });

  it("respecte la longueur demandée", () => {
    for (const max of [12, 25, 50]) {
      expect(excerptFor(body, max).length).toBeLessThanOrEqual(max);
    }
  });

  it("normalise les sauts de ligne — un aperçu tient sur une ligne", () => {
    expect(excerptFor("un\n\ndeux   trois", 200)).toBe("un deux trois");
  });

  it("ne tronque pas un texte déjà assez court", () => {
    expect(excerptFor("Court.", 200)).toBe("Court.");
  });

  it("démontre la fuite que le mauvais ordre produirait", () => {
    // Ce test documente le défaut, pour que personne ne « simplifie » en tronquant d'abord.
    const naive = body.slice(0, 40).replace(/\|\|/g, "");

    expect(naive).toContain("le héros meurt"); // fuite
    expect(excerptFor(body, 40)).not.toContain("le héros"); // pas de fuite
  });
});
