/**
 * Les variantes de couleurs — FR-20.
 *
 * Liste unique, partagée par le sélecteur, l'action serveur et la mise en page. Les
 * identifiants correspondent aux sélecteurs `[data-theme="…"]` de la feuille de style :
 * ajouter une variante demande donc deux gestes, ici et là-bas, et rien d'autre.
 *
 * Une variante N'OVERRIDE QUE DES COULEURS. Typographie, espacements, rayons et composants
 * sont invariants — c'est ce qui rend l'ajout d'une variante trivial et son coût nul en
 * conception.
 */

export const THEMES = [
  { id: "potion-dark", label: "Potion Craft", mode: "sombre" },
  { id: "potion-light", label: "Potion Craft", mode: "clair" },
  { id: "lol-dark", label: "League of Legends", mode: "sombre" },
  { id: "lol-light", label: "League of Legends", mode: "clair" },
  { id: "overwatch-dark", label: "Overwatch", mode: "sombre" },
  { id: "overwatch-light", label: "Overwatch", mode: "clair" },
  { id: "rocket-dark", label: "Rocket League", mode: "sombre" },
  { id: "rocket-light", label: "Rocket League", mode: "clair" },
  { id: "cs-dark", label: "Counter-Strike", mode: "sombre" },
  { id: "cs-light", label: "Counter-Strike", mode: "clair" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

/**
 * Variante par défaut.
 *
 * Sombre, et pas « celle du système » : D13 impose le sombre aux nouveaux venus, et un
 * visiteur sans compte n'a de toute façon pas de préférence enregistrée.
 */
export const THEME_PAR_DEFAUT: ThemeId = "potion-dark";

const IDS: readonly string[] = THEMES.map((t) => t.id);

/**
 * Valide une valeur venue d'un cookie.
 *
 * Un cookie est modifiable par son porteur : sans cette vérification, n'importe quelle chaîne
 * atterrirait dans un attribut du document. Toute valeur inconnue retombe silencieusement sur
 * le défaut — un thème inconnu n'est pas une erreur à signaler, juste un choix qui n'existe
 * plus.
 */
export function themeValide(valeur: string | undefined | null): ThemeId {
  return valeur !== undefined && valeur !== null && IDS.includes(valeur)
    ? (valeur as ThemeId)
    : THEME_PAR_DEFAUT;
}
