/**
 * Arrondi des notes : une décimale, à UN SEUL endroit.
 *
 * Centralisé volontairement. Un arrondi appliqué deux fois dans la chaîne (une fois au
 * calcul, une fois à l'affichage) produit des écarts que personne ne sait expliquer, et
 * deux surfaces peuvent alors afficher deux valeurs différentes pour la même note.
 *
 * La Note globale saisie à la main est un entier ; la valeur calculée porte une décimale
 * (FR-5).
 */
export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
