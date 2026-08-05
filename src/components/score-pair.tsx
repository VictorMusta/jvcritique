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

function ScoreCell({
  score,
  tone,
}: {
  score: DisplayScore;
  tone: "author" | "reader";
}) {
  const shortName = truncateMiddle(score.ownerName, MAX_LABEL);

  return (
    <div className="flex min-w-0 flex-col gap-[2px] rounded-[8px] border border-border bg-surface-raised px-s3 py-s1">
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
        {/* Le nom complet reste exposé au lecteur d'écran, même tronqué à l'écran. */}
        <span className="sr-only">{score.ownerName}</span>
      </span>

      <span
        className={`tnum text-[16px] font-bold leading-tight ${
          tone === "author" ? "text-score-author" : "text-score-reader"
        }`}
      >
        {score.value.toLocaleString("fr-FR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        })}
        <span className="text-[11px] font-normal text-text-muted"> / 20</span>
      </span>
    </div>
  );
}

/**
 * Les deux notes CÔTE À CÔTE EN PERMANENCE, sans bascule ni interaction requise (FR-15).
 *
 * Pas d'onglet, pas de survol, pas de bouton « voir ma note » : la comparaison est la
 * raison d'être du produit, elle ne se mérite pas.
 */
export function ScorePair({ author, reader }: Props) {
  return (
    <div className="flex flex-col gap-s1">
      <div className="flex items-stretch gap-s2">
        <ScoreCell score={author} tone="author" />
        {reader ? <ScoreCell score={reader} tone="reader" /> : null}
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
