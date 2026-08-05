import { scoreModeLabels } from "~/messages/fr";
import type { DomainScores, Weighting } from "../types";
import { computeScore } from "./compute-score";

/**
 * Une note prête à afficher. Les trois champs sont OBLIGATOIRES.
 *
 * INV-5 : une note ne s'affiche jamais sans le nom de son propriétaire ni son échantillon.
 * Rendre `ownerName` et `provenance` non optionnels transforme l'invariant en règle de
 * compilation. Un champ optionnel aurait suffi à le laisser se perdre au douzième appel.
 *
 * Le type vit dans le domaine et non dans le composant : sinon `src/domain/` importerait un
 * fichier React, ce qui casserait la frontière 1.
 */
export type DisplayScore = {
  readonly ownerName: string;
  readonly value: number;
  readonly provenance: string;
};

export type ReviewScoreSource = {
  readonly authorName: string;
  /** Note globale saisie à la main, ou `null` si l'auteur a choisi le mode calculé. */
  readonly overallScoreManual: number | null;
  readonly domainScores: DomainScores;
  readonly authorWeighting: Weighting;
};

/**
 * Note de l'auteur telle qu'elle s'affiche.
 *
 * Rend `null` dans un seul cas : ni saisie manuelle, ni aucun Domaine noté. La V0 empêche
 * cet état à la saisie, mais le représenter explicitement évite d'afficher `NaN` si une
 * donnée ancienne ou importée y arrivait un jour.
 */
export function presentAuthorScore(
  source: ReviewScoreSource,
): DisplayScore | null {
  const { authorName, overallScoreManual, domainScores, authorWeighting } =
    source;

  if (overallScoreManual !== null) {
    return {
      ownerName: authorName,
      value: overallScoreManual,
      provenance: "Note donnée à la main.",
    };
  }

  const outcome = computeScore(domainScores, authorWeighting);

  if (outcome.mode === "none") {
    return null;
  }

  return {
    ownerName: authorName,
    value: outcome.score,
    provenance: scoreModeLabels[outcome.mode](outcome.domainsUsed.length),
  };
}

/**
 * Note relue — la même arithmétique, avec les poids du LECTEUR (FR-15).
 *
 * Rend `null` dans les trois cas où FR-15 l'exige, et il est important qu'ils soient
 * distincts d'un échec :
 *
 * 1. Lecteur non authentifié — il n'a pas de critères à appliquer.
 * 2. Lecteur sans Pondération réglée — il ne voit que la note de l'auteur.
 * 3. Avis sans aucune Note de domaine — il n'y a rien à recalculer.
 *
 * À noter : un Avis dont la note globale a été SAISIE à la main donne quand même une note
 * relue, dès lors qu'il porte des Notes de domaine. Les deux chiffres répondent à deux
 * questions différentes — « quel verdict rend l'auteur » et « que valent ses observations
 * selon mes critères » — et le second reste calculable même quand le premier est arbitraire.
 */
export function presentReaderScore(
  source: Pick<ReviewScoreSource, "domainScores">,
  readerName: string | null,
  readerWeighting: Weighting,
): DisplayScore | null {
  if (readerName === null) {
    return null;
  }

  // Une Pondération vide n'est pas « tous les poids à zéro » : c'est « pas encore réglée ».
  // La distinction compte, parce que des poids réellement tous nuls produiraient une
  // moyenne simple étiquetée, ce qui serait un message trompeur pour quelqu'un qui n'a
  // jamais rien réglé.
  if (Object.keys(readerWeighting).length === 0) {
    return null;
  }

  const outcome = computeScore(source.domainScores, readerWeighting);

  if (outcome.mode === "none") {
    return null;
  }

  return {
    ownerName: readerName,
    value: outcome.score,
    provenance: scoreModeLabels[outcome.mode](outcome.domainsUsed.length),
  };
}
