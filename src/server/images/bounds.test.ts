import { describe, expect, it } from "vitest";

import {
  formatAccepte,
  PIXELS_MAX,
  pixelsAcceptables,
  TAILLE_MAX_OCTETS,
  tailleAcceptable,
} from "./bounds";

describe("tailleAcceptable — 25 Mo, contrôlés avant lecture", () => {
  it("accepte jusqu'à la borne incluse", () => {
    expect(tailleAcceptable(1)).toBe(true);
    expect(tailleAcceptable(TAILLE_MAX_OCTETS)).toBe(true);
  });

  it("refuse au-delà", () => {
    expect(tailleAcceptable(TAILLE_MAX_OCTETS + 1)).toBe(false);
  });

  it("refuse un fichier vide", () => {
    expect(tailleAcceptable(0)).toBe(false);
  });

  it("REFUSE quand la taille est inconnue", () => {
    // On ne peut pas décider sans elle, et le doute ne doit pas profiter à celui qui
    // dépose : sans en-tête de taille, on refuserait sinon après avoir tout lu — ce qui est
    // exactement l'attaque qu'on veut empêcher.
    expect(tailleAcceptable(null)).toBe(false);
    expect(tailleAcceptable(Number.NaN)).toBe(false);
  });
});

describe("formatAccepte — JPEG, PNG, WebP (R-D15)", () => {
  it("accepte les trois formats retenus", () => {
    expect(formatAccepte("jpeg")).toBe(true);
    expect(formatAccepte("png")).toBe(true);
    expect(formatAccepte("webp")).toBe(true);
  });

  it("refuse tout le reste", () => {
    // GIF, SVG et TIFF ne sont pas des oublis : SVG peut contenir du script, et les deux
    // autres n'apportent rien pour une capture de jeu.
    for (const f of ["gif", "svg", "tiff", "avif", "heif", "bmp", ""]) {
      expect(formatAccepte(f)).toBe(false);
    }
  });

  it("refuse un format absent", () => {
    expect(formatAccepte(undefined)).toBe(false);
  });
});

describe("pixelsAcceptables — 50 mégapixels, lus dans les en-têtes", () => {
  it("accepte une capture réaliste", () => {
    // 4K : 8,3 mégapixels.
    expect(pixelsAcceptables(3840, 2160)).toBe(true);
  });

  it("accepte jusqu'à la borne", () => {
    expect(pixelsAcceptables(10_000, 5_000)).toBe(true);
    expect(pixelsAcceptables(PIXELS_MAX, 1)).toBe(true);
  });

  it("REFUSE une bombe de décompression", () => {
    // LE cas qui motive la borne : 200 Ko sur le disque, 900 mégapixels une fois décodés,
    // plusieurs gigaoctets de mémoire. Docker cloisonne les processus, pas la RAM — c'est
    // le seul vecteur restant capable de faire tomber les projets voisins du VPS.
    expect(pixelsAcceptables(30_000, 30_000)).toBe(false);
  });

  it("refuse des dimensions absentes ou absurdes", () => {
    expect(pixelsAcceptables(undefined, 100)).toBe(false);
    expect(pixelsAcceptables(100, undefined)).toBe(false);
    expect(pixelsAcceptables(0, 100)).toBe(false);
    expect(pixelsAcceptables(-10, 100)).toBe(false);
  });
});
