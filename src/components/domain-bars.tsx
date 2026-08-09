import { DOMAIN_KEYS, type DomainScores } from "~/domain/types";
import { domainLabels, domainLabelsCourts } from "~/messages/fr";

/**
 * Les Notes de domaine d'un Avis.
 *
 * Les trois états sont rendus DIFFÉREMMENT, et c'est le point important : « pas évaluable »
 * est affiché explicitement au lieu d'être confondu avec l'absence. Un lecteur doit pouvoir
 * distinguer « l'auteur affirme que ce domaine n'a pas de sens pour ce jeu » de « l'auteur
 * n'en a rien dit » — les deux sortent du calcul, mais ils ne disent pas la même chose.
 *
 * LA DISPOSITION A CHANGÉ LE 10 AOÛT 2026. Sept lignes pleine largeur occupaient 174 px, plus
 * que les notes globales elles-mêmes, pour une information de second plan. Victor a choisi
 * cette version sur maquette : 81 px, soit 54 % de moins, sans qu'aucun nom ni aucune valeur
 * ne disparaisse.
 *
 * LE CHIFFRE PASSE DEVANT, la barre devient un liseré de 3 px. C'est le chiffre qu'on lit
 * réellement ; la barre ne sert qu'à repérer un creux sans lire, et elle n'a pas besoin de
 * plus de place pour ça.
 */
export function DomainBars({ scores }: { readonly scores: DomainScores }) {
  const stated = DOMAIN_KEYS.filter((key) => scores[key] !== undefined);

  if (stated.length === 0) {
    return null;
  }

  return (
    <dl className="grid grid-cols-3 gap-x-s4 gap-y-s3 sm:grid-cols-4">
      {stated.map((key) => {
        const score = scores[key];

        if (score === undefined) {
          return null;
        }

        return (
          /*
           * `title` porte le nom COMPLET : la grille affiche une forme abrégée pour tenir sur
           * trois colonnes, et le nom entier doit rester atteignable. Il l'est aussi pour qui
           * écoute la page, par l'étiquette du groupe.
           */
          <div key={key} className="flex min-w-0 flex-col gap-[1px]">
            <dt className="sr-only">{domainLabels[key]}</dt>
            <dd className="flex flex-col gap-[1px]">
              {score.kind === "rated" ? (
                <>
                  <span className="tnum text-[17px] font-bold leading-none">
                    {score.value}
                  </span>
                  <span
                    className="text-[10px] leading-tight text-text-muted"
                    title={domainLabels[key]}
                  >
                    {domainLabelsCourts[key]}
                  </span>
                  <div
                    className="mt-[2px] h-[3px] overflow-hidden rounded-full bg-surface-raised"
                    role="img"
                    aria-label={`${domainLabels[key]} : ${score.value} sur 20`}
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(score.value / 20) * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/*
                    « Pas évaluable » garde la MÊME PLACE qu'une note, sans quoi la grille se
                    désaligne et l'œil croit qu'il manque quelque chose. Le tiret occupe la
                    ligne du chiffre, et la mention explicite remplace la barre.
                  */}
                  <span className="text-[17px] font-bold leading-none text-text-muted">
                    —
                  </span>
                  <span
                    className="text-[10px] leading-tight text-text-muted"
                    title={domainLabels[key]}
                  >
                    {domainLabelsCourts[key]}
                  </span>
                  <span className="mt-[2px] text-[9px] italic leading-tight text-text-muted">
                    pas évaluable
                  </span>
                </>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
