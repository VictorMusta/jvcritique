import { DOMAIN_KEYS, type DomainScores } from "~/domain/types";
import { domainLabels } from "~/messages/fr";

/**
 * Les Notes de domaine d'un Avis.
 *
 * Les trois états sont rendus DIFFÉREMMENT, et c'est le point important : « pas évaluable »
 * est affiché explicitement au lieu d'être confondu avec l'absence. Un lecteur doit pouvoir
 * distinguer « l'auteur affirme que ce domaine n'a pas de sens pour ce jeu » de « l'auteur
 * n'en a rien dit » — les deux sortent du calcul, mais ils ne disent pas la même chose.
 */
export function DomainBars({ scores }: { readonly scores: DomainScores }) {
  const stated = DOMAIN_KEYS.filter((key) => scores[key] !== undefined);

  if (stated.length === 0) {
    return null;
  }

  return (
    <dl className="flex flex-col gap-s1">
      {stated.map((key) => {
        const score = scores[key];

        if (score === undefined) {
          return null;
        }

        return (
          <div key={key} className="flex items-center gap-s3">
            <dt className="w-[132px] shrink-0 text-[11px] text-text-muted">
              {domainLabels[key]}
            </dt>
            <dd className="flex min-w-0 flex-1 items-center gap-s3">
              {score.kind === "rated" ? (
                <>
                  <div
                    className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-surface-raised"
                    role="img"
                    aria-label={`${score.value} sur 20`}
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(score.value / 20) * 100}%` }}
                    />
                  </div>
                  <span className="tnum w-[28px] shrink-0 text-right text-[12px] font-semibold">
                    {score.value}
                  </span>
                </>
              ) : (
                <span className="text-[11px] italic text-text-muted">
                  pas évaluable
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
