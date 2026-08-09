import Link from "next/link";

import type { EntreeVitrine } from "~/server/db/queries/showcase";

/**
 * La vitrine d'un profil — le « top 5 » demandé par Victor.
 *
 * LA NOTE VIENT DE L'AVIS, elle n'est pas stockée avec la vitrine. Même règle que D3 : une
 * valeur recopiée devient fausse dès que sa source change, et personne ne penserait à
 * corriger sa vitrine après avoir revu la note d'un avis.
 *
 * Une carte SANS note reste une carte valide : l'auteur peut avoir laissé le calcul faire le
 * travail plutôt que de fixer un chiffre. On n'invente rien à la place — INV-5 interdirait de
 * toute façon d'afficher ici une note calculée, qui dépend de qui regarde.
 */
export function Showcase({
  entrees,
  possessif,
}: {
  readonly entrees: readonly EntreeVitrine[];
  /** « Ma vitrine » chez soi, « Sa vitrine » chez les autres. */
  readonly possessif: "ma" | "sa";
}) {
  if (entrees.length === 0) {
    return null;
  }

  return (
    <section className="panneau flex flex-col gap-s4 p-s5">
      <h2 className="font-display text-[15px] font-semibold">
        {possessif === "ma" ? "Ma vitrine" : "Sa vitrine"}
      </h2>

      {/* Défilement horizontal plutôt qu'une grille : cinq cartes tiennent d'un coup sur un
          écran large, et se parcourent au pouce sur un téléphone sans écraser leur texte. */}
      <ul
        className="flex gap-s3 overflow-x-auto pb-s2"
        style={{ scrollbarWidth: "none" }}
      >
        {entrees.map((entree, rang) => (
          <li key={entree.gameId} className="w-[164px] shrink-0">
            <Link
              href={`/review/${entree.reviewId}`}
              className="flex h-full flex-col gap-s2 rounded-[10px] border border-border bg-surface-raised p-s4 hover:border-accent"
            >
              <span className="flex items-baseline justify-between gap-s2">
                <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
                  {rang + 1}
                  <sup>{rang === 0 ? "er" : "e"}</sup>
                </span>
                {entree.scoreManuel !== null ? (
                  <span className="tnum font-display text-[19px] font-bold leading-none text-accent-text">
                    {entree.scoreManuel.toLocaleString("fr-FR", {
                      maximumFractionDigits: 1,
                    })}
                  </span>
                ) : null}
              </span>

              <span className="font-display text-[14px] font-semibold leading-tight">
                {entree.gameTitle}
              </span>

              <span className="text-[11px] italic leading-snug text-text-muted">
                {entree.words}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
