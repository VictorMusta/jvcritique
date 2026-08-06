import Link from "next/link";

import { SignInButton } from "~/components/auth-buttons";
import { ReviewCard } from "~/components/review-card";
import { getFeed } from "~/server/db/queries/reviews";
import { getReaderContext } from "~/server/reader";

/**
 * Le Fil — FR-14.
 *
 * `force-dynamic` : aucun cache de route. D3 impose le recalcul à la lecture, et R-D3
 * rappelle que le cache de Next est actif PAR DÉFAUT. Sans cette déclaration, une
 * pondération modifiée laisserait le fil figé sur les anciennes notes relues — précisément
 * ce que « aucun cache » était censé éviter. L'invariant se déclare route par route (INV-2),
 * il ne se déduit pas.
 */
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const reader = await getReaderContext();
  const feed = await getFeed();

  return (
    <main className="flex flex-col gap-s5 p-s5">
      <header className="flex items-baseline justify-between gap-s4">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          jvcritiqué
        </h1>
        {reader.userId === null ? <SignInButton label="Se connecter" /> : null}
      </header>

      {reader.userId !== null && Object.keys(reader.weighting).length === 0 ? (
        /*
         * Sans pondération, le lecteur ne voit que la note de l'auteur (FR-15) — donc il
         * rate l'intérêt du produit. On le lui dit une fois, sans le bloquer.
         */
        <p className="rounded-[8px] border border-accent/40 bg-surface p-s4 text-[12px]">
          Tu n&apos;as pas encore réglé tes critères, donc tu ne vois que les notes des
          autres.{" "}
          <Link href="/profile" className="font-semibold text-accent">
            Règle ta pondération
          </Link>{" "}
          et chaque avis se recalculera pour toi.
        </p>
      ) : null}

      {feed.length === 0 ? (
        /* Un fil vide invite, il ne montre pas une page blanche (FR-14). Et il ne remonte
           pas d'avis anciens pour se remplir artificiellement. */
        <div className="flex flex-col gap-s4 rounded-[10px] border border-border bg-surface p-s6 text-center">
          <p className="font-display text-[15px]">Rien ici pour l&apos;instant.</p>
          <p className="text-[12px] text-text-muted">
            Le premier avis, c&apos;est le plus dur. Vas-y, note un jeu que tu as aimé.
          </p>
          <Link
            href="/publish"
            className="self-center rounded-[8px] border border-accent bg-accent px-s5 py-[13px] font-semibold text-bg"
          >
            Écrire un avis
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-s4">
          {feed.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              readerName={reader.name}
              readerId={reader.userId}
              readerWeighting={reader.weighting}
            />
          ))}
        </div>
      )}
    </main>
  );
}
