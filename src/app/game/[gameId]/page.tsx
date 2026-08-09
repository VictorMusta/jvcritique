import { notFound } from "next/navigation";

import { GameEditForm } from "~/components/game-edit-form";
import { GameSynthesis } from "~/components/game-synthesis";
import { ReviewCard } from "~/components/review-card";
import { isAdmin } from "~/server/auth/is-admin";
import { getGameById } from "~/server/db/queries/games";
import { getReviewsByGame } from "~/server/db/queries/reviews";
import { synthetiserJeu } from "~/domain/scoring/synthese-jeu";
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
   * COUVERTURE : la première image jamais postée sur ce jeu.
   *
   * Les avis arrivent du plus récent au plus ancien, donc on remonte la liste À L'ENVERS. La
   * couverture reste ainsi la même au fil du temps — la prendre dans le dernier avis en date
   * la ferait changer à chaque publication, et une fiche dont l'illustration bouge sans
   * raison donne l'impression que c'est un autre jeu.
   *
   * Elle sort forcément d'un avis visible : `reviews` est déjà filtré. Une capture déposée
   * dans un avis privé ne peut donc pas illustrer la fiche pour quelqu'un d'autre.
   */
  const couverture = [...reviews]
    .reverse()
    .flatMap((avis) => avis.screenshots)
    .at(0);

  return (
    <main className="flex flex-col gap-s4 p-s3">
      <header className="panneau flex flex-col gap-s3 overflow-hidden p-s5">
        {couverture ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/screenshot/${couverture.storageKey}?v=vignette`}
              /*
               * `alt` vide et volontaire : l'image est DÉCORATIVE. Le titre du jeu est juste
               * en dessous, en toutes lettres — décrire la capture ferait entendre deux fois
               * la même chose à qui écoute la page.
               */
              alt=""
              width={couverture.width}
              height={couverture.height}
              className="-mx-s5 -mt-s5 aspect-[21/9] w-[calc(100%+2*var(--spacing-s5))] border-b border-border object-cover"
            />
          </>
        ) : null}
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
