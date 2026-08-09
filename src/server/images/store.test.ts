import { mkdtempSync, readdirSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// `import type` : effacé à la compilation, donc il ne charge PAS le module. L'import réel
// est plus bas, après que `UPLOADS_DIR` a été posé.
import type * as Store from "./store";

/**
 * Tests du traitement d'images.
 *
 * Ils écrivent sur le disque, dans un dossier temporaire supprimé à la fin. C'est assumé :
 * les règles vérifiées ici — l'orientation appliquée aux pixels, les métadonnées retirées,
 * le renommage atomique — ne se constatent que sur des fichiers réels. Les tester à travers
 * des simulacres reviendrait à vérifier que le code appelle les fonctions qu'on a écrites,
 * pas qu'il produit le bon résultat.
 */

const dossier = mkdtempSync(join(tmpdir(), "jvcritique-images-"));

// Le module lit `UPLOADS_DIR` au chargement : la variable doit être posée AVANT l'import.
process.env.UPLOADS_DIR = dossier;

// Importés dynamiquement : le module lit `UPLOADS_DIR` à son chargement, la variable doit
// donc être posée avant.
let stockerImage: typeof Store.stockerImage;
let cheminDe: typeof Store.cheminDe;

beforeAll(async () => {
  // `module` est un nom réservé côté Next : il ne doit pas être réassigné.
  const store = await import("./store");
  stockerImage = store.stockerImage;
  cheminDe = store.cheminDe;
});

afterAll(async () => {
  // Windows garde parfois un descripteur ouvert le temps que sharp le relâche. L'échec du
  // ménage ne doit pas faire échouer la suite : c'est un dossier temporaire, le système
  // s'en occupera.
  await rm(dossier, { recursive: true, force: true }).catch(() => undefined);
});

/** Une image de test, avec un dégradé pour que la compression ait quelque chose à faire. */
const imageDeTest = (largeur: number, hauteur: number, format: "jpeg" | "png" | "webp") =>
  sharp({
    create: {
      width: largeur,
      height: hauteur,
      channels: 3,
      background: { r: 40, g: 90, b: 160 },
    },
  })
    [format]()
    .toBuffer();

describe("stockerImage — le chemin normal", () => {
  it("réencode en WebP et écrit les deux variantes", async () => {
    const resultat = await stockerImage(await imageDeTest(1200, 800, "png"));

    expect(resultat.ok).toBe(true);

    if (!resultat.ok) return;

    expect(resultat.image.width).toBe(1200);
    expect(resultat.image.height).toBe(800);

    const plein = await sharp(cheminDe(resultat.image.storageKey, "pleine")).metadata();
    const vignette = await sharp(
      cheminDe(resultat.image.storageKey, "vignette"),
    ).metadata();

    expect(plein.format).toBe("webp");
    expect(vignette.format).toBe("webp");
    // La vignette est ramenée à 640 px de large, la pleine garde sa taille.
    expect(vignette.width).toBe(640);
    expect(plein.width).toBe(1200);
  });

  it("accepte les trois formats retenus", async () => {
    for (const format of ["jpeg", "png", "webp"] as const) {
      const resultat = await stockerImage(await imageDeTest(400, 300, format));
      expect(resultat.ok, `format ${format}`).toBe(true);
    }
  });

  it("n'agrandit PAS une image plus étroite que la vignette", async () => {
    // Agrandir n'ajouterait que du flou et des octets.
    const resultat = await stockerImage(await imageDeTest(320, 240, "png"));

    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    const vignette = await sharp(
      cheminDe(resultat.image.storageKey, "vignette"),
    ).metadata();

    expect(vignette.width).toBe(320);
  });

  it("ne laisse AUCUN fichier temporaire derrière lui", async () => {
    await stockerImage(await imageDeTest(500, 500, "png"));

    // Le renommage atomique garantit qu'aucune ligne en base ne peut pointer vers un
    // fichier partiel : tant que le `.part` existe, le nom final n'existe pas.
    expect(readdirSync(dossier).filter((f) => f.endsWith(".part"))).toEqual([]);
  });
});

describe("stockerImage — orientation et métadonnées (R-D15)", () => {
  it("APPLIQUE la rotation EXIF aux pixels", async () => {
    /*
     * LE test du bug « la photo de Théo s'affiche couchée ».
     *
     * L'image fait 600×300 et porte une orientation EXIF 6, qui signifie « à tourner d'un
     * quart de tour ». Après traitement, elle doit mesurer 300×600 : la rotation est dans
     * les pixels, plus dans un champ que quelqu'un pourrait oublier de lire.
     */
    const couchee = await sharp({
      create: {
        width: 600,
        height: 300,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const resultat = await stockerImage(couchee);

    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    expect(resultat.image.width).toBe(300);
    expect(resultat.image.height).toBe(600);
  });

  it("RETIRE les métadonnées, dont la position GPS", async () => {
    // Un téléphone glisse volontiers des coordonnées dans une capture. Le réencodage les
    // retire en bloc, sans liste de champs à maintenir.
    const avecExif = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    })
      .withMetadata({ exif: { IFD0: { Copyright: "Victor", Artist: "Musta" } } })
      .jpeg()
      .toBuffer();

    const resultat = await stockerImage(avecExif);

    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    const octets = await readFile(cheminDe(resultat.image.storageKey, "pleine"));

    // Vérification sur les OCTETS du fichier produit, pas sur ce que sharp veut bien en
    // dire : c'est le fichier qui part chez les autres.
    expect(octets.includes(Buffer.from("Victor"))).toBe(false);
    expect(octets.includes(Buffer.from("Musta"))).toBe(false);
  });
});

describe("stockerImage — ce qui doit être refusé", () => {
  it("refuse ce qui n'est pas une image", async () => {
    const resultat = await stockerImage(Buffer.from("bonjour, je ne suis pas une image"));

    expect(resultat).toEqual({ ok: false, raison: "illisible" });
  });

  it("refuse un format hors des trois retenus", async () => {
    // GIF est lisible par sharp mais absent de la liste : le refus vient de la règle, pas
    // d'une incapacité technique.
    const gif = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#fff" },
    })
      .gif()
      .toBuffer();

    const resultat = await stockerImage(gif);

    expect(resultat).toEqual({ ok: false, raison: "format-refuse" });
  });

  it("refuse une image dépassant 50 mégapixels SANS la décoder", async () => {
    /*
     * La bombe de décompression, fabriquée à la main.
     *
     * Un en-tête PNG déclarant 30000 × 30000 — soit 900 mégapixels — dans un fichier de
     * quelques dizaines d'octets. Les données d'image sont volontairement absurdes : si le
     * refus arrivait APRÈS décodage, ce test ferait exploser la mémoire au lieu de passer.
     * Qu'il s'exécute en quelques millisecondes est la preuve que la borne agit sur les
     * en-têtes.
     */
    const crcTable = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      return c >>> 0;
    });

    const crc32 = (buf: Buffer) => {
      let c = 0xffffffff;
      for (const octet of buf) {
        c = crcTable[(c ^ octet) & 0xff]! ^ (c >>> 8);
      }
      return (c ^ 0xffffffff) >>> 0;
    };

    const chunk = (type: string, donnees: Buffer) => {
      const longueur = Buffer.alloc(4);
      longueur.writeUInt32BE(donnees.length);
      const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(corps));
      return Buffer.concat([longueur, corps, crc]);
    };

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(30000, 0); // largeur
    ihdr.writeUInt32BE(30000, 4); // hauteur
    ihdr[8] = 8; // profondeur
    ihdr[9] = 2; // couleur vraie

    const bombe = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", Buffer.from([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x01])),
      chunk("IEND", Buffer.alloc(0)),
    ]);

    expect(bombe.length).toBeLessThan(200);

    const resultat = await stockerImage(bombe);

    expect(resultat).toEqual({ ok: false, raison: "trop-de-pixels" });
  });
});
