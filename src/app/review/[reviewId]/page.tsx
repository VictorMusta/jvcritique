import Link from "next/link";
import { notFound } from "next/navigation";

import { DomainBars } from "~/components/domain-bars";
import { Comments, type CommentForDisplay } from "~/components/comments";
import { Reactions } from "~/components/reactions";
import { ScreenshotGallery } from "~/components/screenshot-gallery";
import { ScorePair } from "~/components/score-pair";
import { SpoilerScope, SpoilerText } from "~/components/spoiler-text";
import { UpdateNoteForm } from "~/components/update-note-form";
import {
  presentAuthorScore,
  presentReaderScore,
} from "~/domain/scoring/present-score";
import {
  audienceFor,
  renderForAudience,
} from "~/domain/spoilers/render-for-audience";
import { isAdmin } from "~/server/auth/is-admin";
import { getComments } from "~/server/db/queries/comments";
import { getReviewById } from "~/server/db/queries/reviews";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

/** Les quatre champs argumentés (FR-4), tous facultatifs et indépendants. */
const argued = [
  { key: "whyRecommend", label: "Pourquoi je le recommande" },
  { key: "whatMissed", label: "Ce qui m'a manqué" },
  { key: "whatHated", label: "Ce que j'ai détesté" },
  { key: "whyNotRecommend", label: "Pourquoi je ne le recommande pas" },
] as const;

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const review = await getReviewById(reviewId);

  if (!review) {
    notFound();
  }

  const reader = await getReaderContext();
  const isAuthor = reader.userId === review.author.id;

  /*
   * Avis privé — FR-17. Seul l'auteur y accède.
   *
   * FR-16 exige une page « avis non public » EXPLICITE, et pas une erreur technique. La
   * différence compte : un lien partagé puis passé en privé doit expliquer ce qui s'est
   * passé, sinon celui qui clique croit que le site est cassé.
   *
   * On ne révèle rien d'autre : ni le jeu, ni l'auteur, ni la date. Le seul fait divulgué est
   * qu'un avis existe à cette adresse — inévitable, puisque l'URL a été partagée.
   */
  if (review.isPrivate && !isAuthor) {
    return (
      <main className="flex flex-col items-start gap-s4 p-s5">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          Cet avis n&apos;est pas public
        </h1>
        <p className="text-[13px] text-text-muted">
          Son auteur l&apos;a gardé pour lui. Ça arrive — parfois on écrit d&apos;abord pour
          soi.
        </p>
        <Link href="/" className="text-[12px] font-semibold text-accent">
          Retour au fil
        </Link>
      </main>
    );
  }

  /*
   * L'audience est décidée UNE FOIS, puis appliquée à tous les champs. La calculer par
   * champ ouvrirait la possibilité qu'un champ soit rendu avec la mauvaise.
   */
  const audience = audienceFor(reader.userId, review.author.id);

  // Chaque champ passe par la fonction d'audience — frontière 4 : c'est le seul chemin d'un
  // texte d'avis vers quelque chose d'affichable.
  const sections = argued.flatMap(({ key, label }) => {
    const body = review[key];

    if (body === null) {
      return [];
    }

    return [{ key, label, segments: renderForAudience(body, audience) }];
  });

  // FR-6 : « tout révéler » agit sur l'avis entier, donc l'information doit être calculée
  // sur l'ensemble des champs, pas champ par champ.
  const hasSpoilers = sections.some((section) =>
    section.segments.some((segment) => segment.kind === "spoiler"),
  );

  const author = presentAuthorScore({
    authorName: review.author.name ?? "Quelqu'un",
    overallScoreManual: review.overallScoreManual,
    domainScores: review.domainScores,
    authorWeighting: review.authorWeighting,
  });

  const readerScore = presentReaderScore(review, reader.name, reader.weighting);

  const admin = await isAdmin(reader.userId);

  /*
   * Les commentaires sont préparés ICI, côté serveur, et passés en segments déjà filtrés.
   *
   * Le composant ne reçoit jamais de texte brut : c'est ce qui rend impossible d'afficher un
   * spoiler en clair depuis cette surface, sans avoir à y penser (frontière 4). Et l'audience
   * se calcule par rapport à l'auteur DU COMMENTAIRE, pas à celui de l'avis — c'est lui qui a
   * écrit le passage masqué.
   */
  const comments: CommentForDisplay[] = (await getComments(review.id)).map(
    (comment) => ({
      id: comment.id,
      segments: renderForAudience(
        comment.body,
        audienceFor(reader.userId, comment.author.id),
      ),
      createdAt: comment.createdAt.toLocaleDateString("fr-FR", dateFormat),
      authorName: comment.author.name ?? "Quelqu'un",
      canDelete: admin || reader.userId === comment.author.id,
    }),
  );

  const playtime: string[] = [];
  if (review.playtimeHours !== null) {
    playtime.push(`${review.playtimeHours} h de jeu`);
  }
  if (review.completed) {
    playtime.push("terminé");
  }

  const dateFormat: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };

  return (
    <main className="flex flex-col gap-s5 p-s5">
      <header className="flex flex-col gap-s2">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          <Link href={`/game/${review.game.id}`} className="hover:text-accent">
            {review.game.title}
          </Link>
        </h1>
        <p className="text-[12px] text-text-muted">
          par {review.author.name ?? "Quelqu'un"}
          {playtime.length > 0 ? <> · {playtime.join(" · ")}</> : null}
          {" · "}
          <time dateTime={review.createdAt.toISOString()}>
            {review.createdAt.toLocaleDateString("fr-FR", dateFormat)}
          </time>
          {/* FR-9 : un avis modifié porte une date de dernière modification VISIBLE. */}
          {review.updatedAt ? (
            <>
              {" · modifié le "}
              <time dateTime={review.updatedAt.toISOString()}>
                {review.updatedAt.toLocaleDateString("fr-FR", dateFormat)}
              </time>
            </>
          ) : null}
        </p>
        {isAuthor ? (
          <Link
            href={`/review/${review.id}/edit`}
            className="self-start text-[12px] font-semibold text-accent"
          >
            Modifier
          </Link>
        ) : null}
      </header>

      {author ? (
        <ScorePair author={author} reader={readerScore ?? undefined} />
      ) : (
        <p className="text-[12px] italic text-text-muted">
          Cet avis ne porte aucune note.
        </p>
      )}

      <section className="flex flex-col gap-s3 rounded-[10px] border border-border bg-surface p-s4">
        <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
          Par domaine
        </h2>
        <DomainBars scores={review.domainScores} />
      </section>

      {/* Une seule portée pour tout l'avis : « tout révéler » découvre les passages de TOUS
          les champs, pas seulement celui qu'on a cliqué. */}
      <SpoilerScope hasSpoilers={hasSpoilers}>
        <div className="flex flex-col gap-s5">
          {sections.map(({ key, label, segments }) => (
            <section key={key} className="flex flex-col gap-s2">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
                {label}
              </h2>
              <p className="text-[13px] leading-relaxed">
                <SpoilerText segments={segments} gameTitle={review.game.title} />
              </p>
            </section>
          ))}
        </div>
      </SpoilerScope>

      {/* Notes de mise à jour, après le corps, dans l'ordre chronologique (FR-10). */}
      {review.updateNotes.length > 0 ? (
        <section className="flex flex-col gap-s4">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
            Mises à jour
          </h2>
          {review.updateNotes.map((note) => (
            <article
              key={note.id}
              className="flex flex-col gap-s2 rounded-[10px] border border-border bg-surface p-s4"
            >
              <time
                dateTime={note.createdAt.toISOString()}
                className="text-[11px] text-text-muted"
              >
                {note.createdAt.toLocaleDateString("fr-FR", dateFormat)}
              </time>
              <p className="text-[13px] leading-relaxed">
                <SpoilerText
                  segments={renderForAudience(note.body, audience)}
                  gameTitle={review.game.title}
                />
              </p>
            </article>
          ))}
        </section>
      ) : null}

      {review.screenshots.length > 0 ? (
        <section className="flex flex-col gap-s3">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
            Captures
          </h2>
          <ScreenshotGallery
            screenshots={review.screenshots}
            gameTitle={review.game.title}
          />
        </section>
      ) : null}

      <Reactions
        reviewId={review.id}
        reactions={review.reactions}
        viewerId={reader.userId}
        isAuthor={isAuthor}
      />

      {isAuthor ? <UpdateNoteForm reviewId={review.id} /> : null}

      <Comments
        reviewId={review.id}
        gameTitle={review.game.title}
        comments={comments}
        canWrite={reader.userId !== null}
      />

      {review.game.steamUrl ? (
        <a
          href={review.game.steamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-accent"
        >
          Voir sur Steam →
        </a>
      ) : null}
    </main>
  );
}
