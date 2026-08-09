import Link from "next/link";

import { SignInButton, SignOutButton } from "~/components/auth-buttons";
import { ReviewCard } from "~/components/review-card";
import { ReviewFilters } from "~/components/review-filters";
import { Showcase } from "~/components/showcase";
import { appliquerFiltre, filtreValide } from "~/domain/filtres-avis";
import { getReviewsByAuthor } from "~/server/db/queries/reviews";
import { synthetiserJeu } from "~/domain/scoring/synthese-jeu";
import { listerTodo } from "~/server/db/queries/todos";
import { getVitrine } from "~/server/db/queries/showcase";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const reader = await getReaderContext();

  if (reader.userId === null) {
    return (
      <main className="flex flex-col items-start gap-s5 p-s5">
        <h1 className="font-display text-[25px] font-semibold">Ton profil</h1>
        <p className="text-[13px] text-text-muted">
          Connecte-toi pour régler tes critères et publier des avis.
        </p>
        <SignInButton />
      </main>
    );
  }

  const reviews = await getReviewsByAuthor(reader.userId, reader.userId);

  // Le compte n'est calculé que pour un administrateur : personne d'autre ne peut agir
  // dessus, et l'afficher exposerait une information d'exploitation à qui n'en fait rien.
  const filtre = filtreValide((await searchParams).f);
  const affiches = appliquerFiltre(reviews, filtre);

  /*
   * Les chiffres portent sur TOUS les avis, jamais sur la sélection en cours : une moyenne
   * recalculée sur « ses bangers » vaudrait toujours 18 et quelque, et ne dirait plus rien.
   */
  const aFaire = await listerTodo(reader.userId);

  const vitrine = await getVitrine(reader.userId);

  const stats = synthetiserJeu(reviews);

  // Les heures non renseignées ne comptent pas pour zéro : elles ne comptent pas du tout.
  const heures = reviews.reduce((total, r) => total + (r.playtimeHours ?? 0), 0);
  const termines = reviews.filter((r) => r.completed).length;

  return (
    <main className="flex flex-col gap-s4 p-s3">
      <header className="panneau flex items-baseline justify-between gap-s4 p-s5">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          {reader.name}
        </h1>
        <div className="flex shrink-0 items-center gap-s4">
          <Link
            href="/reglages"
            className="flex items-center gap-s2 rounded-[8px] border border-accent px-s4 py-s2 text-[12px] font-semibold text-accent-text"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
            Réglages
          </Link>
          <SignOutButton />
        </div>
      </header>

      {/* La vitrine passe AVANT les chiffres : c'est ce que la personne a choisi de
          montrer, les chiffres ne sont qu'un résumé de ce qu'elle a fait. */}
      <Showcase entrees={vitrine} possessif="ma" />

      {/*
        LES CHIFFRES DU COMPTE — demandés par Victor.

        Ils sortent des avis DÉJÀ CHARGÉS, et la note moyenne passe par `synthetiserJeu`, la
        même fonction que la synthèse d'un jeu. Une seconde implémentation de « faire une
        moyenne » finirait par diverger de la première, et deux chiffres différents
        s'afficheraient pour la même chose à deux endroits du produit.
      */}
      <section className="panneau grid grid-cols-2 gap-s4 p-s5 sm:grid-cols-4">
        <Chiffre valeur={String(reviews.length)} legende={reviews.length === 1 ? "avis écrit" : "avis écrits"} />
        <Chiffre
          valeur={
            stats.globale === null
              ? "—"
              : stats.globale.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })
          }
          legende="note moyenne"
        />
        <Chiffre valeur={String(heures)} legende={heures === 1 ? "heure de jeu" : "heures de jeu"} />
        <Chiffre valeur={String(termines)} legende={termines === 1 ? "jeu terminé" : "jeux terminés"} />
      </section>

      {/*
        SA LISTE, SUR SON PROFIL SEULEMENT. Elle n'apparaît pas sur le profil public de
        quelqu'un d'autre : c'est une intention, pas une déclaration — et savoir qu'elle
        serait lue changerait ce qu'on y met.
      */}
      {aFaire.length > 0 ? (
        <section className="panneau flex flex-col gap-s3 p-s5">
          <h2 className="font-display text-[15px] font-semibold">
            À faire ({aFaire.length})
          </h2>
          <ul className="flex flex-col gap-s2">
            {aFaire.map((jeu) => (
              <li key={jeu.gameId}>
                <Link
                  href={`/game/${jeu.gameId}`}
                  className="flex items-baseline justify-between gap-s4 rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 hover:border-accent"
                >
                  <span className="font-display text-[15px]">{jeu.title}</span>
                  <span className="shrink-0 text-[11px] text-text-muted">
                    {jeu.ajouteLe.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-s4">
        <div className="panneau flex flex-col gap-s4 px-s5 py-s4">
          <h2 className="font-display text-[15px] font-semibold">
            Tes avis {reviews.length > 0 ? `(${reviews.length})` : null}
          </h2>
          {reviews.length > 0 ? (
            <ReviewFilters actif={filtre} base="/profile" />
          ) : null}
        </div>

        {affiches.length === 0 ? (
          <p className="text-[12px] text-text-muted">
            {reviews.length === 0
              ? "Tu n’as encore rien écrit."
              : "Aucun avis dans cette catégorie. Essaie « Tous »."}
          </p>
        ) : (
          affiches.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              /*
               * Pas de note relue sur ses propres avis : ce serait deux fois le même chiffre
               * côte à côte, avec deux étiquettes différentes — le contraire de ce que la
               * paire de notes sert à montrer.
               */
              readerName={null}
              /*
               * `readerId` reste renseigné même si `readerName` est nul : la note relue est
               * inutile sur ses propres avis, mais l'audience des spoilers doit rester
               * « auteur » — sinon Victor verrait ses propres passages masqués chez lui.
               */
              readerId={reader.userId}
              readerWeighting={{}}
            />
          ))
        )}
      </section>
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
