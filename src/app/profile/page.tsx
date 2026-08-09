import { AnnounceBacklog } from "~/components/announce-backlog";
import { SignInButton, SignOutButton } from "~/components/auth-buttons";
import { ReviewCard } from "~/components/review-card";
import { ThemePicker } from "~/components/theme-picker";
import { WeightingForm } from "~/components/weighting-form";
import { themeValide } from "~/domain/themes";
import { cookies } from "next/headers";
import { getReviewsByAuthor } from "~/server/db/queries/reviews";
import { isAdmin } from "~/server/auth/is-admin";
import { countPendingAnnouncements } from "~/server/db/queries/announcements";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
  const enAttente = (await isAdmin(reader.userId))
    ? await countPendingAnnouncements()
    : 0;

  return (
    <main className="flex flex-col gap-s4 p-s3">
      <header className="panneau flex items-baseline justify-between gap-s4 p-s5">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          {reader.name}
        </h1>
        <SignOutButton />
      </header>

      <AnnounceBacklog enAttente={enAttente} />

      <WeightingForm initial={reader.weighting} />

      <ThemePicker actuel={themeValide((await cookies()).get("theme")?.value)} />

      <section className="flex flex-col gap-s4">
        <h2 className="panneau px-s5 py-s4 font-display text-[15px] font-semibold">
          Tes avis {reviews.length > 0 ? `(${reviews.length})` : null}
        </h2>

        {reviews.length === 0 ? (
          <p className="text-[12px] text-text-muted">
            Tu n&apos;as encore rien écrit.
          </p>
        ) : (
          reviews.map((review) => (
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
