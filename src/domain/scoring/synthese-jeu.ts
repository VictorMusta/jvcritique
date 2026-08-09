import { computeScore } from "./compute-score";
import { DOMAIN_KEYS, type DomainKey, type DomainScores, type Weighting } from "../types";

/**
 * Synthèse d'un Jeu — FR-24, la moyenne de ses avis.
 *
 * LE PROBLÈME DE FOND : une moyenne est une note SANS PROPRIÉTAIRE. Tout le produit repose
 * sur l'inverse — INV-5 interdit d'afficher un score sans le nom de celui qui l'a donné, et
 * la paire « ta note / sa note » existe justement pour qu'aucun chiffre ne passe pour un
 * verdict. Un « 16,4 » nu en haut d'une fiche de jeu détruirait ça d'un coup.
 *
 * Ce que la moyenne porte à la place d'un nom, c'est son ÉCHANTILLON. Chaque valeur rendue ici
 * est indissociable du nombre d'avis dont elle est tirée — c'est un couple, pas un nombre avec
 * une information annexe qu'une surface pourrait oublier d'afficher. Une moyenne sur deux avis
 * et une moyenne sur vingt ne se lisent pas pareil, et le type l'impose.
 *
 * LA MOYENNE PORTE SUR LES AVIS REÇUS, ET SUR EUX SEULS. La page passe ceux qu'elle affiche —
 * donc déjà filtrés selon ce que le lecteur a le droit de voir (FR-17). Une agrégation SQL
 * séparée aurait pu compter un avis privé invisible à l'écran : le chiffre n'aurait alors
 * correspondu à rien de ce que le lecteur peut vérifier.
 */

/** Une moyenne et l'échantillon dont elle sort. Jamais l'un sans l'autre. */
export type Moyenne = {
  readonly valeur: number;
  /** Nombre d'avis qui ont réellement contribué. */
  readonly echantillon: number;
};

export type SyntheseJeu = {
  /**
   * Moyenne des Notes globales. `null` si aucun avis n'en porte — ce qui arrive dès qu'ils
   * ne notent que du texte, et n'est pas une anomalie.
   */
  readonly globale: Moyenne | null;
  /**
   * Moyenne par Domaine, dans l'ordre du glossaire. Un Domaine que personne n'a noté est
   * ABSENT, et non présent à zéro : zéro est une note légitime, l'absence n'en est pas une.
   */
  readonly parDomaine: readonly { readonly domain: DomainKey; readonly moyenne: Moyenne }[];
};

type AvisPourSynthese = {
  readonly overallScoreManual: number | null;
  readonly domainScores: DomainScores;
  readonly authorWeighting: Weighting;
};

/**
 * La note d'un avis, telle que SON AUTEUR la donne.
 *
 * Saisie à la main si elle existe, calculée avec la pondération de l'auteur sinon. Et surtout
 * PAS avec la pondération du lecteur : la note relue (FR-15) est une lecture personnelle, elle
 * change d'un visiteur à l'autre. Une fiche de jeu qui afficherait une moyenne différente pour
 * chacun ne voudrait plus rien dire — deux personnes ne pourraient plus en parler.
 */
export function noteDeLAuteur(avis: AvisPourSynthese): number | null {
  if (avis.overallScoreManual !== null) {
    return avis.overallScoreManual;
  }

  const resultat = computeScore(avis.domainScores, avis.authorWeighting);

  // `none` ne porte AUCUN champ `score` : le type interdit de lire une note qui n'existe pas.
  return resultat.mode === "none" ? null : resultat.score;
}

export function synthetiserJeu(
  avis: readonly AvisPourSynthese[],
): SyntheseJeu {
  const notes = avis
    .map(noteDeLAuteur)
    .filter((note): note is number => note !== null);

  const parDomaine: { domain: DomainKey; moyenne: Moyenne }[] = [];

  for (const domain of DOMAIN_KEYS) {
    const valeurs: number[] = [];

    for (const un of avis) {
      const score = un.domainScores[domain];
      // `notApplicable` est écarté comme `empty` : « pas évaluable » n'est pas un zéro, et
      // le compter en tirerait la moyenne vers le bas sans que personne ne l'ait voulu.
      if (score?.kind === "rated") {
        valeurs.push(score.value);
      }
    }

    if (valeurs.length > 0) {
      parDomaine.push({ domain, moyenne: moyenner(valeurs) });
    }
  }

  return {
    globale: notes.length > 0 ? moyenner(notes) : null,
    parDomaine,
  };
}

/**
 * Moyenne arithmétique, arrondie au dixième.
 *
 * Le même arrondi que les notes individuelles du produit : deux chiffres présentés côte à côte
 * avec des précisions différentes se compareraient mal, et l'écart passerait pour une
 * différence de valeur alors qu'il ne serait qu'un défaut de mise en forme.
 */
function moyenner(valeurs: readonly number[]): Moyenne {
  const somme = valeurs.reduce((total, valeur) => total + valeur, 0);

  return {
    valeur: Math.round((somme / valeurs.length) * 10) / 10,
    echantillon: valeurs.length,
  };
}
