import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import {
  DELAI_MAX_MS,
  formatAccepte,
  PIXELS_MAX,
  pixelsAcceptables,
  type RefusDepot,
} from "./bounds";

/**
 * Stockage des screenshots — FR-8, R-D5, R-D15.
 *
 * Les fichiers vivent sur un VOLUME, pas dans l'image Docker : celle-ci est reconstruite à
 * chaque déploiement, et tout ce qu'on y écrirait disparaîtrait au premier `up --build`.
 */

const RACINE = process.env.UPLOADS_DIR ?? "/app/uploads";

/** Largeur de la vignette servie dans le fil. */
const LARGEUR_VIGNETTE = 640;

/**
 * Qualité du réencodage.
 *
 * 88 en WebP, choisi contre le réflexe d'économiser des octets : Victor a été explicite —
 * « je veux la qualité au max en cliquant sur les images » — et ses amis regardent depuis
 * chez eux, pas en 4G. À ce niveau, l'aplat d'un ciel de Valheim ne montre pas de blocs.
 */
const QUALITE = 88;
const QUALITE_VIGNETTE = 78;

export type DepotReussi = {
  storageKey: string;
  width: number;
  height: number;
};

export type DepotResultat =
  | { ok: true; image: DepotReussi }
  | { ok: false; raison: RefusDepot };

const cheminOriginal = (cle: string) => join(RACINE, `${cle}.webp`);
const cheminVignette = (cle: string) => join(RACINE, `${cle}-vignette.webp`);

export function cheminDe(cle: string, variante: "pleine" | "vignette") {
  return variante === "vignette" ? cheminVignette(cle) : cheminOriginal(cle);
}

/**
 * Réencode une image déposée et l'écrit sur le volume.
 *
 * L'ordre des contrôles est une propriété de sécurité :
 *
 * 1. Les métadonnées sont lues d'abord — cette lecture ne DÉCODE pas l'image.
 * 2. Le format et le nombre de pixels sont vérifiés sur ces métadonnées.
 * 3. Le décodage n'a lieu qu'ensuite, sur une image dont on sait qu'elle est raisonnable.
 *
 * Inverser 2 et 3 rendrait la borne des 50 mégapixels inutile : on aurait déjà alloué les
 * gigaoctets qu'elle sert à refuser.
 */
export async function stockerImage(
  donnees: Buffer,
): Promise<DepotResultat> {
  await mkdir(RACINE, { recursive: true });

  const cle = randomUUID();
  // Nom TEMPORAIRE puis renommage atomique : rien n'est visible tant que le fichier n'est
  // pas complet, donc aucune ligne en base ne peut pointer vers un fichier partiel.
  const tempPlein = `${cheminOriginal(cle)}.part`;
  const tempVignette = `${cheminVignette(cle)}.part`;

  const nettoyer = async () => {
    await Promise.allSettled([unlink(tempPlein), unlink(tempVignette)]);
  };

  // Abandon au-delà de 30 secondes. Sans borne, un fichier pathologique monopoliserait un
  // cœur du VPS partagé jusqu'à ce que quelqu'un s'en aperçoive.
  const chrono = new Promise<DepotResultat>((resolve) =>
    setTimeout(() => resolve({ ok: false, raison: "illisible" }), DELAI_MAX_MS),
  );

  const traitement = (async (): Promise<DepotResultat> => {
    let metadonnees;

    try {
      /*
       * `limitInputPixels: false` UNIQUEMENT pour lire les en-têtes.
       *
       * sharp applique sa propre borne de pixels et lève avant de rendre les dimensions —
       * ce qui refuserait bien la bombe, mais sous le motif « illisible ». On veut pouvoir
       * dire à l'utilisateur que son image est trop grande, donc on lit d'abord, on juge
       * ensuite avec NOTRE borne.
       *
       * Lever la limite ici est sans danger : lire un en-tête n'alloue pas la mémoire des
       * pixels. C'est le décodage qui coûte, et il est plus bas, avec la limite en place.
       */
      metadonnees = await sharp(donnees, { limitInputPixels: false }).metadata();
    } catch {
      return { ok: false, raison: "illisible" };
    }

    if (!formatAccepte(metadonnees.format)) {
      return { ok: false, raison: "format-refuse" };
    }

    if (!pixelsAcceptables(metadonnees.width, metadonnees.height)) {
      return { ok: false, raison: "trop-de-pixels" };
    }

    try {
      /*
       * `rotate()` sans argument APPLIQUE l'orientation EXIF aux pixels.
       *
       * C'est ce qui rend le bug « la photo s'affiche couchée » impossible plutôt
       * qu'évité : il n'y a plus de champ d'orientation à préserver ni à interpréter,
       * puisque les pixels sont déjà dans le bon sens (R-D15).
       *
       * Le réencodage retire aussi TOUTES les métadonnées en bloc — dont la position GPS
       * qu'un téléphone glisse volontiers dans une capture d'écran.
       */
      // La borne est ici passée à sharp lui-même : elle s'applique pendant le décodage, et
      // pas seulement à la lecture des en-têtes. Deux gardes valent mieux qu'une quand la
      // seconde ne coûte qu'un paramètre.
      const base = sharp(donnees, { limitInputPixels: PIXELS_MAX }).rotate();

      const plein = await base.clone().webp({ quality: QUALITE }).toBuffer({
        resolveWithObject: true,
      });

      const vignette = await base
        .clone()
        // `withoutEnlargement` : une capture plus étroite que 640 px ne doit pas être
        // agrandie, ça ne ferait qu'ajouter du flou et des octets.
        .resize({ width: LARGEUR_VIGNETTE, withoutEnlargement: true })
        .webp({ quality: QUALITE_VIGNETTE })
        .toBuffer();

      await writeFile(tempPlein, plein.data);
      await writeFile(tempVignette, vignette);

      await rename(tempPlein, cheminOriginal(cle));
      await rename(tempVignette, cheminVignette(cle));

      return {
        ok: true,
        image: {
          storageKey: cle,
          width: plein.info.width,
          height: plein.info.height,
        },
      };
    } catch {
      return { ok: false, raison: "illisible" };
    }
  })();

  const resultat = await Promise.race([traitement, chrono]);

  if (!resultat.ok) {
    await nettoyer();
  }

  return resultat;
}

/** Supprime les deux fichiers d'une image. Idempotent. */
export async function supprimerImage(cle: string): Promise<void> {
  await Promise.allSettled([
    unlink(cheminOriginal(cle)),
    unlink(cheminVignette(cle)),
  ]);
}
