import Link from "next/link";
import { notFound } from "next/navigation";

import { ReviewCard } from "~/components/review-card";
import { ReviewFilters } from "~/components/review-filters";
import { appliquerFiltre, filtreValide } from "~/domain/filtres-avis";
import { synthetiserJeu } from "~/domain/scoring/synthese-jeu";
import { getReviewsByAuthor, getUserPublic } from "~/server/db/queries/reviews";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

/**
 * Le profil de QUELQU'UN D'AUTRE — demandé par Victor.
 *
 * LA CONFIDENTIALITÉ N'EST PAS TRAITÉE ICI, et c'est délibéré. `getReviewsByAuthor` reçoit
 * l'identifiant du lecteur et écarte déjà les avis privés qui ne lui appartiennent pas
 * (FR-17). Refiltrer dans la page en ferait une SECONDE implémentation de la règle — et la
 * seule chose garantie avec deux implémentations d'une règle de confidentialité, c'est
 * qu'un jour l'une des deux sera oubliée.
 *
 * Quelqu'un qui ouvre son propre profil par cette adresse voit donc bien ses avis privés :
 * c'est la même règle appliquée au même endroit, pas une exception.
 */
export default async function ProfilPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { userId } = await params;
  const auteur = await getUserPublic(userId);

  if (auteur === null) {
    // Inventer un profil vide laisserait croire que la personne existe et n'a rien écrit.
    notFound();
  }

  const reader = await getReaderContext();
  const avis = await getReviewsByAuthor(userId, reader.userId);

  const filtre = filtreValide((await searchParams).f);
  const affiches = appliquerFiltre(avis, filtre);

  /*
   * Les chiffres portent sur TOUS ses avis visibles, jamais sur la sélection en cours.
   *
   * Une moyenne recalculée sur « ses bangers » vaudrait toujours 18 et quelque, et ne dirait
   * plus rien de personne. Les chiffres décrivent quelqu'un ; le filtre ne sert qu'à
   * parcourir ce qu'il a écrit.
   */
  const stats = synthetiserJeu(avis);
  const heures = avis.reduce((total, a) => total + (a.playtimeHours ?? 0), 0);
  const termines = avis.filter((a) => a.completed).length;

  const soi = reader.userId === userId;

  return (
    <main className="flex flex-col gap-s4 p-s3">
      <header className="panneau flex items-baseline justify-between gap-s4 p-s5">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          {auteur.name ?? "Quelqu'un"}
        </h1>
        {soi ? (
          <Link
            href="/profile"
            className="shrink-0 text-[12px] text-text-muted underline decoration-dotted underline-offset-2"
          >
            Ton profil
          </Link>
        ) : null}
      </header>

      {/* Les mêmes chiffres que sur son propre profil, par la même fonction : deux façons de
          compter finiraient par donner deux résultats pour la même personne. */}
      <section className="panneau grid grid-cols-2 gap-s4 p-s5 sm:grid-cols-4">
        <Chiffre
          valeur={String(avis.length)}
          legende={avis.length === 1 ? "avis écrit" : "avis écrits"}
        />
        <Chiffre
          valeur={
            stats.globale === null
              ? "—"
              : stats.globale.valeur.toLocaleString("fr-FR", {
                  maximumFractionDigits: 1,
                })
          }
          legende="note moyenne"
        />
        <Chiffre
          valeur={String(heures)}
          legende={heures === 1 ? "heure de jeu" : "heures de jeu"}
        />
        <Chiffre
          valeur={String(termines)}
          legende={termines === 1 ? "jeu terminé" : "jeux terminés"}
        />
      </section>

      <div className="panneau flex flex-col gap-s4 p-s5">
        <ReviewFilters actif={filtre} base={`/profile/${userId}`} />

        {affiches.length === 0 ? (
          <p className="text-[12px] leading-snug text-text-muted">
            {avis.length === 0
              ? "Cette personne n’a pas encore publié d’avis."
              : "Aucun avis dans cette catégorie. Essaie « Tous »."}
          </p>
        ) : null}
      </div>

      {affiches.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          /*
           * La note relue s'affiche ici, contrairement à son propre profil : sur les avis de
           * quelqu'un d'autre, comparer sa note à la sienne est précisément l'intérêt.
           */
          readerName={soi ? null : reader.name}
          readerId={reader.userId}
          readerWeighting={soi ? {} : reader.weighting}
        />
      ))}
    </main>
  );
}

/** Un chiffre et ce qu'il compte. La légende n'est jamais facultative. */
function Chiffre({
  valeur,
  legende,
}: {
  readonly valeur: string;
  readonly legende: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="tnum font-display text-[26px] font-bold leading-none">
        {valeur}
      </span>
      <span className="text-[11px] leading-snug text-text-muted">{legende}</span>
    </div>
  );
}
