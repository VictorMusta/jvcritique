/**
 * LE PAQUET — les quatre gestes, et la règle qui les distingue.
 *
 * Quand il reste des avis non vus, le Fil s'ouvre sur un paquet de cartes : un avis à la fois,
 * et pour chacun quatre façons de passer au suivant. Trois d'entre elles s'appuient sur ce qui
 * existe déjà — la réaction haut/bas, la liste de souhaits — ; la quatrième, « passer », ne
 * pose que la marque « vu ». Toutes les quatre marquent l'avis comme vu : c'est ce qui fait
 * que le paquet ne revient jamais deux fois avec la même carte.
 *
 * Ce fichier est PUR : il ne connaît ni le DOM, ni la base. C'est ce qui permet de tester la
 * seule chose qui mérite un test ici — à partir de quel déplacement un geste est reconnu, et
 * lequel quand les deux axes sont en jeu.
 */

export const GESTES = ["aime", "pas_pour_moi", "souhait", "passer"] as const;
export type Geste = (typeof GESTES)[number];

/**
 * Distance, en pixels, au-delà de laquelle un déplacement devient un geste.
 *
 * 90 px : assez pour qu'un pouce qui hésite ne déclenche rien, assez peu pour qu'un balayage
 * franc n'ait pas à traverser l'écran. Sous ce seuil, relâcher ramène la carte au centre.
 */
export const SEUIL_GESTE = 90;

/**
 * Traduit un déplacement (dx vers la droite, dy vers le bas) en geste, ou en rien.
 *
 * L'AXE DOMINANT L'EMPORTE : un balayage est rarement parfaitement horizontal, et il ne faut
 * pas qu'un « j'aime » lancé un peu vers le bas devienne un « passer ». À égalité stricte,
 * l'horizontal gagne — ce sont les deux gestes qu'on fait le plus, et le plus vite.
 */
export function resoudreGeste(dx: number, dy: number, seuil = SEUIL_GESTE): Geste | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < seuil && ay < seuil) {
    return null;
  }
  if (ax >= ay) {
    return dx > 0 ? "aime" : "pas_pour_moi";
  }
  return dy < 0 ? "souhait" : "passer";
}

/**
 * Ce que chaque geste affiche : le tampon pendant le mouvement, le libellé du bouton, la
 * touche du clavier sur PC. Un seul endroit, pour que le tampon, le bouton et l'aide clavier
 * ne puissent pas se contredire.
 */
export const LIBELLES_GESTE: Readonly<
  Record<Geste, { readonly tampon: string; readonly bouton: string; readonly touche: string }>
> = {
  pas_pour_moi: { tampon: "PAS POUR MOI", bouton: "Pas pour moi", touche: "ArrowLeft" },
  passer: { tampon: "VU", bouton: "Passer", touche: "ArrowDown" },
  souhait: { tampon: "À SOUHAITER", bouton: "À souhaiter", touche: "ArrowUp" },
  aime: { tampon: "J’AIME", bouton: "J’aime", touche: "ArrowRight" },
};

/** Le geste associé à une touche, ou rien si la touche n'en est pas une. */
export function gestePourTouche(touche: string): Geste | null {
  for (const geste of GESTES) {
    if (LIBELLES_GESTE[geste].touche === touche) {
      return geste;
    }
  }
  return null;
}
