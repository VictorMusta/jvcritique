import { noteDeLAuteur } from "./scoring/synthese-jeu";
import type { DomainScores, Weighting } from "./types";

/**
 * Filtres d'une liste d'avis — demandés par Victor : « ses bangers », « ses avis
 * désastreux », le temps de jeu.
 *
 * LES SEUILS SONT ASSUMÉS, ET DITS. 17 et 8 ne sortent de nulle part : ils découpent une
 * note sur 20 en « je le défends » et « je le déconseille », en laissant au milieu la zone
 * la plus large — celle des avis nuancés, qui sont la majorité. Un seuil plus haut viderait
 * la première catégorie, un seuil plus bas ferait passer pour un désastre un jeu simplement
 * moyen.
 *
 * La note employée est celle de L'AUTEUR, jamais la note relue du visiteur : « ses bangers »
 * doit désigner ce que LUI a aimé. Filtrer sur la note recalculée pour le lecteur
 * renverrait des avis que l'auteur n'a jamais présentés comme des coups de cœur.
 */

export const FILTRES = [
  { id: "tous", label: "Tous" },
  { id: "bangers", label: "Ses bangers" },
  { id: "desastres", label: "Ses désastres" },
  { id: "termines", label: "Terminés" },
  { id: "longues", label: "Les plus longs" },
] as const;

export type FiltreId = (typeof FILTRES)[number]["id"];

const IDS: readonly string[] = FILTRES.map((f) => f.id);

/**
 * Valide un filtre venu de l'URL.
 *
 * Une valeur inconnue retombe sur « tous » plutôt que de ne rien afficher : un lien tronqué
 * ou une faute de frappe ne doit pas donner une page vide qui se lit comme « cette personne
 * n'a rien écrit ».
 */
export function filtreValide(valeur: string | undefined | null): FiltreId {
  return valeur !== undefined && valeur !== null && IDS.includes(valeur)
    ? (valeur as FiltreId)
    : "tous";
}

/** Au-dessus, c'est un coup de cœur. */
const SEUIL_BANGER = 17;
/** En dessous, c'est un rejet. */
const SEUIL_DESASTRE = 8;

type AvisFiltrable = {
  readonly overallScoreManual: number | null;
  readonly domainScores: DomainScores;
  readonly authorWeighting: Weighting;
  readonly playtimeHours: number | null;
  readonly completed: boolean;
};

export function appliquerFiltre<T extends AvisFiltrable>(
  avis: readonly T[],
  filtre: FiltreId,
): T[] {
  switch (filtre) {
    case "tous":
      return [...avis];

    /*
     * LES DEUX SÉLECTIONS SONT TRIÉES PAR NOTE, en sens opposés — demandé par Victor le
     * 10 août 2026.
     *
     * Le tri chronologique n'a pas de sens ici : « ses bangers » répond à « qu'est-ce qu'il a
     * le plus aimé », donc le plus aimé se lit d'abord. Et « ses désastres » à la question
     * symétrique, donc le pire d'abord. Trier du plus récent au plus ancien, comme le reste du
     * fil, obligerait à parcourir la liste pour trouver ce qu'on est venu chercher.
     */
    case "bangers":
      return trierParNote(
        avis.filter((a) => {
          const note = noteDeLAuteur(a);
          return note !== null && note >= SEUIL_BANGER;
        }),
        "descendant",
      );

    case "desastres":
      return trierParNote(
        avis.filter((a) => {
          const note = noteDeLAuteur(a);
          return note !== null && note <= SEUIL_DESASTRE;
        }),
        "ascendant",
      );

    case "termines":
      return avis.filter((a) => a.completed);

    case "longues":
      // Un TRI, pas un filtre : les avis sans temps de jeu restent dans la liste, à la fin.
      // Les écarter reviendrait à dire « ce jeu ne compte pas », alors que l'auteur a
      // seulement omis de remplir un champ facultatif.
      return [...avis].sort(
        (a, b) => (b.playtimeHours ?? -1) - (a.playtimeHours ?? -1),
      );
  }
}

/**
 * Trie par note de l'auteur.
 *
 * Les avis sans note ne se présentent pas ici — les deux filtres qui appellent cette fonction
 * les ont déjà écartés. Le repli à zéro n'est donc pas un choix de rangement mais une
 * précaution : il garantit un ordre défini si un troisième appelant apparaissait un jour.
 */
function trierParNote<T extends AvisFiltrable>(
  avis: readonly T[],
  sens: "ascendant" | "descendant",
): T[] {
  return [...avis].sort((a, b) => {
    const na = noteDeLAuteur(a) ?? 0;
    const nb = noteDeLAuteur(b) ?? 0;

    return sens === "descendant" ? nb - na : na - nb;
  });
}
