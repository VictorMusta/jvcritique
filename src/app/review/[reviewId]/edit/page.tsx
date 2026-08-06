import { notFound, redirect } from "next/navigation";

import { ReviewForm } from "~/components/review-form";
import { getReviewForEdit } from "~/server/db/queries/reviews";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

export default async function EditReviewPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const reader = await getReaderContext();

  if (reader.userId === null) {
    redirect(`/review/${reviewId}`);
  }

  /*
   * La requête est bornée à l'auteur : elle ne rend rien si l'avis n'est pas le sien.
   * On répond donc 404 aussi bien pour « n'existe pas » que pour « n'est pas à toi » —
   * distinguer les deux révélerait à un tiers qu'un avis existe à cet identifiant.
   */
  const review = await getReviewForEdit(reviewId, reader.userId);

  if (!review) {
    notFound();
  }

  return (
    <main className="flex flex-col gap-s6 p-s5">
      <header className="flex flex-col gap-s1">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          Modifier ton avis
        </h1>
        <p className="text-[12px] text-text-muted">{review.gameTitle}</p>
      </header>

      <ReviewForm
        authorName={reader.name ?? "Toi"}
        authorWeighting={reader.weighting}
        initial={review}
      />
    </main>
  );
}
