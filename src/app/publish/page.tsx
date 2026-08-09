import Link from "next/link";

import { SignInButton } from "~/components/auth-buttons";
import { ReviewForm } from "~/components/review-form";
import { listGamesForPicker } from "~/server/db/queries/games";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

export default async function PublishPage({
  searchParams,
}: {
  searchParams: Promise<{ jeu?: string }>;
}) {
  const reader = await getReaderContext();
  const { jeu } = await searchParams;

  if (reader.userId === null) {
    return (
      <main className="flex flex-col items-start gap-s5 p-s5">
        <h1 className="font-display text-[25px] font-semibold">Écrire un avis</h1>
        <p className="text-[13px] text-text-muted">
          Connecte-toi pour publier.
        </p>
        <SignInButton />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-s4 p-s3">
      {/* Un formulaire est presque entièrement du texte : il lui faut une surface opaque. */}
      <div className="panneau flex flex-col gap-s6 p-s5">
      <h1 className="font-display text-[25px] font-semibold leading-tight">
        Écrire un avis
      </h1>

      {Object.keys(reader.weighting).length === 0 ? (
        /*
         * Sans pondération réglée, la note calculée retombe sur la moyenne simple. Ce n'est
         * pas un blocage — l'auteur peut écrire son avis quand même — mais autant le lui
         * dire avant qu'il s'étonne du chiffre affiché.
         */
        <p className="rounded-[8px] border border-accent/40 bg-surface p-s4 text-[12px]">
          Tu n&apos;as pas réglé tes critères, donc la note calculée sera une simple
          moyenne.{" "}
          <Link href="/profile" className="font-semibold text-accent-text">
            Les régler d&apos;abord
          </Link>{" "}
          prend une minute.
        </p>
      ) : null}

      <ReviewForm
        authorName={reader.name ?? "Toi"}
        authorWeighting={reader.weighting}
        existingGames={await listGamesForPicker()}
        /*
         * Le titre venu de l'URL est une SUGGESTION, pas une consigne : il remplit le champ,
         * qui reste modifiable, et un brouillon en cours le remplace. Quelqu'un qui avait
         * commencé un avis ailleurs ne doit pas le perdre parce qu'il a cliqué sur une fiche.
         */
        titreJeuPropose={jeu?.slice(0, 255)}
      />
      </div>
    </main>
  );
}
