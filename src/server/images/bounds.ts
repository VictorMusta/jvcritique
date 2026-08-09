/**
 * Les trois bornes du dépôt d'images — R-D5.
 *
 * Isolées ici, en fonctions pures, parce que ce sont des propriétés de SÉCURITÉ et non des
 * réglages de confort. Mêlées au code de traitement, elles se seraient contournées à la
 * première refonte sans que rien ne le signale.
 */

/** 25 Mo. Refusé AVANT lecture du flux, jamais après. */
export const TAILLE_MAX_OCTETS = 25 * 1024 * 1024;

/**
 * 50 mégapixels, vérifiés dans les EN-TÊTES du fichier avant tout décodage.
 *
 * Ce n'est pas une limite esthétique. Une bombe de décompression de 200 Ko peut se
 * décompresser en 30000 × 30000, soit 900 mégapixels et plusieurs gigaoctets de mémoire.
 * Le cloisonnement Docker isole les processus et les réseaux, **il ne cloisonne pas la
 * RAM** : c'est le seul vecteur restant capable de faire tomber les projets voisins du VPS.
 */
export const PIXELS_MAX = 50_000_000;

/** 30 secondes. Au-delà, abandon propre et fichier temporaire supprimé. */
export const DELAI_MAX_MS = 30_000;

/** Formats acceptés (R-D15). Tout le reste est refusé avant décodage. */
export const FORMATS_ACCEPTES = ["jpeg", "png", "webp"] as const;

export type FormatAccepte = (typeof FORMATS_ACCEPTES)[number];

export type RefusDepot =
  | "trop-gros"
  | "format-refuse"
  | "trop-de-pixels"
  /** Le fichier reçu n'est pas une image exploitable. */
  | "illisible"
  /**
   * L'image était bonne, c'est le stockage qui a échoué.
   *
   * Distingué d'« illisible » après un vrai incident : un volume Docker appartenant à root
   * empêchait l'écriture, et l'utilisateur lisait « cette image n'a pas pu être lue » — un
   * message qui l'envoyait chercher un problème dans son fichier alors qu'il était sur le
   * serveur. Une panne qui accuse l'utilisateur est pire qu'une panne muette.
   */
  | "stockage-indisponible";

/**
 * Contrôle la taille annoncée AVANT de lire le flux.
 *
 * L'ordre est le point important : accepter le flux puis mesurer reviendrait à charger
 * 200 Mo en mémoire pour ensuite les refuser, ce qui est précisément l'attaque.
 */
export function tailleAcceptable(octetsAnnonces: number | null): boolean {
  // Une taille absente est traitée comme suspecte : on ne peut pas décider sans elle, et
  // le doute ne doit pas profiter à celui qui dépose.
  if (octetsAnnonces === null || Number.isNaN(octetsAnnonces)) {
    return false;
  }

  return octetsAnnonces > 0 && octetsAnnonces <= TAILLE_MAX_OCTETS;
}

export function formatAccepte(format: string | undefined): format is FormatAccepte {
  return (
    format !== undefined &&
    (FORMATS_ACCEPTES as readonly string[]).includes(format)
  );
}

/**
 * Contrôle le nombre de pixels annoncé par les en-têtes.
 *
 * `largeur` et `hauteur` viennent de la lecture des métadonnées, qui ne décode PAS l'image.
 * C'est ce qui rend le contrôle utile : refuser après décodage arriverait trop tard.
 */
export function pixelsAcceptables(
  largeur: number | undefined,
  hauteur: number | undefined,
): boolean {
  if (!largeur || !hauteur || largeur <= 0 || hauteur <= 0) {
    return false;
  }

  return largeur * hauteur <= PIXELS_MAX;
}
