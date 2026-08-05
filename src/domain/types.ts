/**
 * Types du domaine.
 *
 * FRONTIÈRE 1 — ce dossier n'importe RIEN du framework : ni Next, ni Drizzle, ni React.
 * C'est la frontière la plus importante du projet. Elle garantit trois choses à la fois :
 * les fonctions pures restent testables sans infrastructure, l'implémentation unique du
 * moteur de notation a un domicile évident, et un agent tenté d'en écrire une seconde
 * version se heurte à un dossier où rien ne l'aiderait à tricher.
 *
 * Le code est en anglais, le glossaire en français. La correspondance est NORMATIVE et
 * vit dans docs/lexicon.md. Aucun synonyme.
 */

/**
 * Les sept Domaines, dans l'ordre du glossaire. Correspondance figée :
 *
 * | Français                            | Code              |
 * |-------------------------------------|-------------------|
 * | gameplay                            | `gameplay`        |
 * | histoire                            | `story`           |
 * | ambiance                            | `atmosphere`      |
 * | direction artistique et graphismes  | `artDirection`    |
 * | bande-son                           | `soundtrack`      |
 * | durée de vie et rythme              | `pacing`          |
 * | technique                           | `technical`       |
 */
export const DOMAIN_KEYS = [
  "gameplay",
  "story",
  "atmosphere",
  "artDirection",
  "soundtrack",
  "pacing",
  "technical",
] as const;

export type DomainKey = (typeof DOMAIN_KEYS)[number];

/**
 * Note de domaine — trois états DISTINCTS, et la distinction est structurelle.
 *
 * - `rated` : un jugement porté, de 0 à 20. **Zéro est une note légitime**, pas une absence.
 * - `empty` : aucun jugement porté.
 * - `notApplicable` : « Pas évaluable » — le Domaine n'a pas de sens pour ce Jeu.
 *
 * `empty` et `notApplicable` sont exclus du calcul **à l'identique** : l'arithmétique ne
 * les distingue pas. La distinction sert l'affichage, et elle doit survivre en base parce
 * que la Synthèse par domaine (FR-24) la lira un jour. Les fusionner maintenant
 * détruirait une information qu'on ne pourrait pas reconstituer.
 */
export type DomainScore =
  | { readonly kind: "rated"; readonly value: number }
  | { readonly kind: "empty" }
  | { readonly kind: "notApplicable" };

/** Pondération — l'importance de 0 à 100 accordée à chaque Domaine. Une par Utilisateur. */
export type Weighting = Readonly<Partial<Record<DomainKey, number>>>;

/** Les Notes de domaine d'un Avis. Un Domaine absent de l'objet vaut `empty`. */
export type DomainScores = Readonly<Partial<Record<DomainKey, DomainScore>>>;

/**
 * Résultat du moteur de notation : la note, les Domaines qui l'ont produite, et son
 * MODE D'OBTENTION.
 *
 * Noter que le mode `none` ne porte **aucun champ `score`**. Ce n'est pas une omission :
 * c'est le système de types qui rend impossible l'affichage d'une note qui n'existe pas.
 * Un `score` optionnel aurait laissé passer un `undefined` rendu à l'écran.
 *
 * De même, `domainsUsed` est toujours présent — INV-5 exige qu'une note ne s'affiche
 * jamais sans son échantillon. Le type le rend disponible partout où la note l'est.
 */
export type ScoreOutcome =
  | {
      /** Moyenne pondérée par la Pondération, renormalisée sur les Domaines notés. */
      readonly mode: "weighted";
      readonly score: number;
      readonly domainsUsed: readonly DomainKey[];
    }
  | {
      /**
       * Repli : la somme des poids applicables est nulle. La moyenne simple est rendue,
       * ÉTIQUETÉE comme telle. Une note de repli ne doit jamais être présentée comme une
       * note personnalisée.
       */
      readonly mode: "simpleMean";
      readonly score: number;
      readonly domainsUsed: readonly DomainKey[];
    }
  | {
      /** Aucun Domaine noté : il n'existe pas de note pondérable. */
      readonly mode: "none";
      readonly domainsUsed: readonly [];
    };
