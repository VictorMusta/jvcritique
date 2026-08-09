import Link from "next/link";

import { SignInButton } from "~/components/auth-buttons";
import { InstallPrompt } from "~/components/install-prompt";
import { ThemeOnboarding } from "~/components/theme-onboarding";
import { cookies } from "next/headers";
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
  const feed = await getFeed(reader.userId);

  /*
   * L'accueil se déclenche sur l'ABSENCE de cookie, pas sur une date d'inscription.
   *
   * C'est ce qui le fait apparaître aux amis de Victor qui ont déjà un compte — ils n'ont
   * jamais rien choisi — sans ajouter de colonne ni de migration. Répondre pose le cookie,
   * donc la question ne revient pas ; sur un nouvel appareil elle se repose, ce qui est le
   * bon comportement pour un réglage propre à l'appareil.
   */
  const aChoisiSonTheme = (await cookies()).has("theme");

  return (
    <main className="flex flex-col gap-s5 p-s5">
      {reader.userId !== null && !aChoisiSonTheme ? <ThemeOnboarding /> : null}

      <header className="flex items-baseline justify-between gap-s4">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          jvcritiqué
        </h1>
        <div className="flex items-center gap-s3">
          <InstallPrompt />
          {reader.userId === null ? <SignInButton label="Se connecter" /> : null}
        </div>
      </header>

      {reader.userId !== null && Object.keys(reader.weighting).length === 0 ? (
        /*
         * Sans pondération, le lecteur ne voit que la note de l'auteur (FR-15) — donc il
         * rate l'intérêt du produit. On le lui dit une fois, sans le bloquer.
         */
        <p className="rounded-[8px] border border-accent/40 bg-surface p-s4 text-[12px]">
          Tu n&apos;as pas encore réglé tes critères, donc tu ne vois que les notes des
          autres.{" "}
          <Link href="/profile" className="font-semibold text-accent-text">
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
            className="self-center rounded-[8px] border border-accent bg-accent px-s5 py-[13px] font-semibold text-on-accent"
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
