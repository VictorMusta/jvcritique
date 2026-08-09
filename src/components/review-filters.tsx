import Link from "next/link";

import { FILTRES, type FiltreId } from "~/domain/filtres-avis";

/**
 * Les filtres d'une liste d'avis — demandés par Victor.
 *
 * DES LIENS, PAS DES BOUTONS, et ce n'est pas un détail de mise en œuvre. Le filtre vit dans
 * l'URL : il se partage, il survit à un rechargement, il se range dans l'historique, et le
 * bouton « précédent » du navigateur revient au filtre d'avant plutôt qu'à la page
 * précédente. Rien de tout cela n'est gratuit avec un état local, et tout est perdu au
 * premier rechargement.
 *
 * Aucun JavaScript non plus : la page est déjà rendue à chaque requête, filtrer côté serveur
 * ne coûte donc rien de plus.
 */
export function ReviewFilters({
  actif,
  base,
}: {
  readonly actif: FiltreId;
  /** Chemin de la page qui porte la liste — le profil de quelqu'un, le sien. */
  readonly base: string;
}) {
  return (
    <nav
      aria-label="Filtrer les avis"
      className="flex flex-wrap gap-s2 overflow-x-auto"
    >
      {FILTRES.map(({ id, label }) => {
        const choisi = id === actif;

        return (
          <Link
            key={id}
            // « Tous » n'ajoute pas de paramètre : l'état par défaut mérite l'URL la plus
            // courte, et c'est celle qu'on partage le plus souvent.
            href={id === "tous" ? base : `${base}?f=${id}`}
            aria-current={choisi ? "page" : undefined}
            className={`shrink-0 rounded-full border px-s4 py-s2 text-[12px] ${
              choisi
                ? "border-accent bg-accent font-semibold text-on-accent"
                : "border-border text-text-muted"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
