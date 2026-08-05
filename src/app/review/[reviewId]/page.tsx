import Link from "next/link";
import { notFound } from "next/navigation";

import { DomainBars } from "~/components/domain-bars";
import { ScorePair } from "~/components/score-pair";
import {
  presentAuthorScore,
  presentReaderScore,
} from "~/domain/scoring/present-score";
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

  const author = presentAuthorScore({
    authorName: review.author.name ?? "Quelqu'un",
    overallScoreManual: review.overallScoreManual,
    domainScores: review.domainScores,
    authorWeighting: review.authorWeighting,
  });

  const readerScore = presentReaderScore(
    review,
    reader.name,
    reader.weighting,
  );

  const playtime: string[] = [];
  if (review.playtimeHours !== null) {
    playtime.push(`${review.playtimeHours} h de jeu`);
  }
  if (review.completed) {
    playtime.push("terminé");
  }

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
            {review.createdAt.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>
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

      {argued.map(({ key, label }) => {
        const text = review[key];

        if (text === null) {
          return null;
        }

        return (
          <section key={key} className="flex flex-col gap-s2">
            <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
              {label}
            </h2>
            {/* whitespace-pre-line : les sauts de ligne de l'auteur sont conservés. Sans
                ça, un avis rédigé en paragraphes s'affiche en un bloc illisible. */}
            <p className="whitespace-pre-line text-[13px] leading-relaxed">{text}</p>
          </section>
        );
      })}

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
