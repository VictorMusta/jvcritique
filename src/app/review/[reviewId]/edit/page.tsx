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
    <main className="flex flex-col gap-s4 p-s3">
      {/*
        LE PANNEAU MANQUAIT ICI, et c'est la même régression que celle corrigée hier sur le
        profil et la page d'un avis. Signalé par Victor : sur téléphone, le formulaire
        d'édition laissait voir le motif partout, donc du texte posé sur un damier.
        La page de rédaction l'avait reçu, celle de MODIFICATION avait été oubliée — deux
        écrans qui affichent le même formulaire.
      */}
      <div className="panneau flex flex-col gap-s6 p-s5">
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
      </div>
    </main>
  );
}
