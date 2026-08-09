import type { SyntheseJeu } from "~/domain/scoring/synthese-jeu";
import { domainLabels } from "~/messages/fr";

/**
 * La Synthèse d'un Jeu — FR-24.
 *
 * TOUT CE COMPOSANT EXISTE POUR UNE PHRASE : dire sur quoi la moyenne porte. Le reste n'est
 * qu'une barre et un chiffre.
 *
 * INV-5 interdit d'afficher un score sans le nom de celui qui l'a donné. Une moyenne n'a pas
 * de nom à donner — ce qu'elle porte à la place, c'est son ÉCHANTILLON. « 16,4 » nu se lirait
 * comme un verdict ; « 16,4, moyenne de 3 avis » se lit pour ce que c'est.
 *
 * L'échantillon est répété PAR DOMAINE parce qu'il y varie : sur trois avis, deux peuvent
 * avoir noté le gameplay et un seul la bande-son. Un échantillon global affiché une fois en
 * haut laisserait croire que chaque ligne repose sur le même nombre d'avis.
 */
export function GameSynthesis({ synthese }: { readonly synthese: SyntheseJeu }) {
  if (synthese.globale === null && synthese.parDomaine.length === 0) {
    // Aucun avis noté : il n'y a rien à synthétiser, et une section vide vaudrait moins que
    // pas de section du tout.
    return null;
  }

  return (
    <section className="flex flex-col gap-s4 rounded-[10px] border border-border bg-surface-raised p-s4">
      <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
        Ce que le groupe en dit
      </h2>

      {synthese.globale !== null ? (
        <div className="flex flex-col gap-[2px]">
          <p className="flex items-baseline gap-s2">
            <span className="tnum font-display text-[32px] font-bold leading-none">
              {synthese.globale.valeur.toLocaleString("fr-FR", {
                maximumFractionDigits: 1,
              })}
            </span>
            <span className="text-[13px] text-text-muted">/ 20</span>
          </p>
          {/*
            La mention n'est PAS décorative, et elle ne doit jamais devenir facultative :
            c'est elle qui empêche la moyenne de se lire comme un verdict.
          */}
          <p className="text-[11px] italic leading-snug text-text-muted">
            Moyenne des notes de {phraseEchantillon(synthese.globale.echantillon)}. Chacun
            garde la sienne.
          </p>
        </div>
      ) : null}

      {synthese.parDomaine.length > 0 ? (
        <dl className="flex flex-col gap-s1">
          {synthese.parDomaine.map(({ domain, moyenne }) => (
            <div key={domain} className="flex items-center gap-s3">
              <dt className="w-[132px] shrink-0 text-[11px] text-text-muted">
                {domainLabels[domain]}
              </dt>
              <dd className="flex min-w-0 flex-1 items-center gap-s3">
                <div
                  className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-surface"
                  role="img"
                  aria-label={`${moyenne.valeur} sur 20, moyenne de ${phraseEchantillon(moyenne.echantillon)}`}
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(moyenne.valeur / 20) * 100}%` }}
                  />
                </div>
                <span className="tnum w-[34px] shrink-0 text-right text-[12px] font-semibold">
                  {moyenne.valeur.toLocaleString("fr-FR", {
                    maximumFractionDigits: 1,
                  })}
                </span>
                {/*
                  L'échantillon de CETTE ligne, et pas celui du jeu : sur trois avis, deux
                  peuvent avoir noté le gameplay et un seul la bande-son.
                */}
                <span
                  className="tnum w-[30px] shrink-0 text-right text-[10px] text-text-muted"
                  title={`Moyenne de ${phraseEchantillon(moyenne.echantillon)}`}
                >
                  ×{moyenne.echantillon}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

function phraseEchantillon(n: number): string {
  return n === 1 ? "1 avis" : `${n} avis`;
}
