import Link from "next/link";
import { notFound } from "next/navigation";

import { GameEditForm } from "~/components/game-edit-form";
import { GameGallery } from "~/components/game-gallery";
import { GameSynthesis } from "~/components/game-synthesis";
import { ReviewCard } from "~/components/review-card";
import { isAdmin } from "~/server/auth/is-admin";
import { getGameById } from "~/server/db/queries/games";
import { getReviewsByGame } from "~/server/db/queries/reviews";
import { synthetiserJeu } from "~/domain/scoring/synthese-jeu";
import { couvertureSteam } from "~/domain/steam";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const game = await getGameById(gameId);

  if (!game) {
    notFound();
  }

  // Séquentiel et non `Promise.all` : la liste des avis DÉPEND du lecteur, puisqu'un avis
  // privé n'est visible que de son auteur (FR-17). Les paralléliser reviendrait à demander
  // les avis avant de savoir qui les demande.
  const reader = await getReaderContext();
  const reviews = await getReviewsByGame(gameId, reader.userId);
  const admin = await isAdmin(reader.userId);

  /*
   * La synthèse est calculée SUR LES AVIS DÉJÀ CHARGÉS, et pas par une agrégation SQL à part.
   *
   * Ceux-là sont exactement ceux que le lecteur a le droit de voir (FR-17). Une requête
   * séparée aurait pu compter un avis privé absent de l'écran : le chiffre n'aurait alors
   * correspondu à rien de vérifiable. Ici, ce qui est moyenné est ce qui est affiché en
   * dessous, et c'est aussi la mise en œuvre de D3 — recalculé à la lecture, jamais stocké.
   */
  const synthese = synthetiserJeu(reviews);

  /*
   * TOUTES les captures du jeu, du plus ancien avis au plus récent.
   *
   * La liste arrive du plus récent au plus ancien : on la remonte à l'envers pour que la
   * galerie s'ouvre sur la PREMIÈRE image jamais postée. Elle reste ainsi la même au fil du
   * temps — s'ouvrir sur la dernière publiée changerait l'illustration à chaque avis, et une
   * fiche dont l'image bouge sans raison donne l'impression d'être un autre jeu.
   *
   * Elles sortent forcément d'avis visibles : `reviews` est déjà filtré. Une capture déposée
   * dans un avis privé ne peut donc pas illustrer la fiche pour quelqu'un d'autre.
   */
  /*
   * L'avis que le lecteur a DÉJÀ écrit sur ce jeu, s'il en a un.
   *
   * Une personne ne peut avoir qu'un avis par jeu : envoyer quelqu'un vers un formulaire
   * vierge le mènerait droit à un refus « avis déjà écrit ». Le bouton propose donc de
   * modifier au lieu d'écrire — la même intention, la seule voie qui aboutisse.
   */
  const sienDejaEcrit =
    reader.userId === null
      ? undefined
      : reviews.find((avis) => avis.author.id === reader.userId);

  const captures = [...reviews].reverse().flatMap((avis) =>
    avis.screenshots.map((image) => ({
      storageKey: image.storageKey,
      width: image.width,
      height: image.height,
      reviewId: avis.id,
      authorName: avis.author.name ?? "Quelqu'un",
    })),
  );

  return (
    <main className="flex flex-col gap-s4 p-s3">
      <header className="panneau flex flex-col overflow-hidden">
        {/* HORS du rembourrage, et c'est tout l'intérêt : la galerie occupe la largeur du
            panneau sans qu'aucune marge n'ait à être annulée. */}
        <GameGallery
          images={captures}
          gameTitle={game.title}
          /*
           * Repli quand aucune capture n'existe encore. Un jeu sans lien Steam n'en a pas —
           * et c'est réparable en deux gestes : un administrateur colle le lien sur la fiche,
           * la couverture apparaît. Aucune image n'est copiée nulle part.
           */
          couverture={couvertureSteam(game.steamUrl)}
        />

        <div className="flex flex-col gap-s3 p-s5">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          {game.title}
        </h1>
        <p className="text-[12px] text-text-muted">
          {reviews.length === 1 ? "1 avis" : `${reviews.length} avis`}
        </p>
        {/*
          EN HAUT ET PLEINE LARGEUR, en aplat d'accent — demandé par Victor. C'est l'action
          que la fiche existe pour provoquer : lire ce que les autres en ont dit, puis dire
          ce qu'on en pense. La reléguer en bas de page reviendrait à espérer que le lecteur
          y arrive.
        */}
        <Link
          href={
            sienDejaEcrit
              ? `/review/${sienDejaEcrit.id}/edit`
              : `/publish?jeu=${encodeURIComponent(game.title)}`
          }
          className="flex items-center justify-center gap-s3 rounded-[8px] bg-accent px-s5 py-s4 text-[13px] font-semibold text-on-accent"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          {sienDejaEcrit ? "Modifier mon avis" : "Donner mon avis"}
        </Link>

        {game.steamUrl ? (
          <a
            href={game.steamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-accent-text"
          >
            Voir sur Steam →
          </a>
        ) : null}

        {/* Entretien du catalogue, réservé aux administrateurs. Le masquage n'est qu'une
            politesse d'interface : le contrôle qui compte est dans l'action serveur. */}
        {admin ? (
          <GameEditForm
            gameId={game.id}
            initialTitle={game.title}
            initialSteamUrl={game.steamUrl}
          />
        ) : null}
        </div>
      </header>

      {/* FR-24, à l'endroit que la note d'intention de la V0 lui réservait. */}
      {reviews.length > 0 ? (
        <div className="panneau flex flex-col gap-s4 p-s5">
          <GameSynthesis synthese={synthese} />
        </div>
      ) : null}

      <div className="flex flex-col gap-s4">
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            readerName={reader.name}
            readerId={reader.userId}
            readerWeighting={reader.weighting}
            showGameTitle={false}
          />
        ))}
      </div>
    </main>
  );
}
