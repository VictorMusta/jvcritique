import type { DisplayScore } from "~/domain/scoring/present-score";
import { truncateMiddle } from "./truncate-middle";

type Props = {
  readonly author: DisplayScore;
  /**
   * Note relue. Absente dans trois cas légitimes : le lecteur n'est pas connecté, il n'a
   * pas réglé sa Pondération, ou l'Avis ne porte aucune Note de domaine.
   */
  readonly reader?: DisplayScore;
};

const MAX_LABEL = 12;

/**
 * Une note, en GRAND.
 *
 * La spine définit un jeton `score-lg` à 34 px que rien n'utilisait à l'affichage : les notes
 * sortaient en 16 px, et le seul gros chiffre du produit apparaissait dans l'aperçu du
 * formulaire. L'auteur voyait donc une note imposante en écrivant, et le lecteur une
 * étiquette — exactement à l'envers.
 *
 * Or la comparaison de deux notes EST la thèse du produit. Si un seul élément de l'écran a le
 * droit d'être grand, c'est celui-là. Un écran où tout a le même poids est un écran où rien
 * n'a d'importance.
 */
function ScoreCell({
  score,
  tone,
}: {
  score: DisplayScore;
  tone: "author" | "reader";
}) {
  const shortName = truncateMiddle(score.ownerName, MAX_LABEL);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
      {/*
        L'étiquette de propriétaire n'est JAMAIS supprimée : c'est la seule distinction non
        chromatique entre les deux notes. Un lecteur qui ne perçoit pas la différence de
        couleur doit pouvoir dire à qui appartient chaque chiffre.
      */}
      <span
        className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted"
        title={score.ownerName}
      >
        <span aria-hidden>{shortName}</span>
        <span className="sr-only">{score.ownerName}</span>
      </span>

      <span
        className={`tnum text-[34px] font-bold leading-none ${
          tone === "author" ? "text-score-author" : "text-score-reader"
        }`}
      >
        {score.value.toLocaleString("fr-FR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        })}
        <span className="text-[13px] font-normal text-text-muted"> / 20</span>
      </span>
    </div>
  );
}

/**
 * Les deux notes CÔTE À CÔTE EN PERMANENCE, sans bascule ni interaction requise (FR-15).
 *
 * Pas d'onglet, pas de survol, pas de bouton « voir ma note » : la comparaison est la raison
 * d'être du produit, elle ne se mérite pas.
 */
export function ScorePair({ author, reader }: Props) {
  return (
    <div className="flex flex-col gap-s2">
      <div className="flex items-start gap-s5">
        <ScoreCell score={author} tone="author" />
        {reader ? (
          <>
            {/*
              Un filet vertical plutôt qu'un cadre autour de chaque note : il sépare sans
              enfermer, et c'est la comparaison — donc l'écart entre les deux — qui doit
              rester le sujet.
            */}
            <span aria-hidden className="w-px self-stretch bg-border/60" />
            <ScoreCell score={reader} tone="reader" />
          </>
        ) : null}
      </div>

      {/*
        La provenance de chaque note, toujours affichée (INV-5). C'est ce qui permet à une
        note de 20/20 obtenue sur un seul domaine de ne pas se faire passer pour un verdict
        d'ensemble — on accepte la note aberrante, on annonce son échantillon.
      */}
      <p className="text-[11px] italic leading-snug text-text-muted">
        {author.provenance}
        {reader ? <> · {reader.provenance}</> : null}
      </p>
    </div>
  );
}
