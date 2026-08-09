import { notFound } from "next/navigation";

import { GameEditForm } from "~/components/game-edit-form";
import { ReviewCard } from "~/components/review-card";
import { isAdmin } from "~/server/auth/is-admin";
import { getGameById } from "~/server/db/queries/games";
import { getReviewsByGame } from "~/server/db/queries/reviews";
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

  return (
    <main className="flex flex-col gap-s5 p-s5">
      <header className="flex flex-col gap-s2">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          {game.title}
        </h1>
        <p className="text-[12px] text-text-muted">
          {reviews.length === 1 ? "1 avis" : `${reviews.length} avis`}
        </p>
        {game.steamUrl ? (
          <a
            href={game.steamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-accent"
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
      </header>

      {/*
        La Synthèse par domaine (FR-24) est reportée après la V0. Elle viendra ici, et son
        libellé devra dire explicitement qu'elle ne porte que sur les avis affichés sur cette
        page — sans quoi une moyenne sur deux avis se lirait comme un verdict.
      */}

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
