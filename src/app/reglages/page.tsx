import Link from "next/link";
import { cookies } from "next/headers";

import { AnnounceBacklog } from "~/components/announce-backlog";
import { SignInButton } from "~/components/auth-buttons";
import { NotificationsSysteme } from "~/components/notifications-systeme";
import { ShowcaseForm } from "~/components/showcase-form";
import { ThemePicker } from "~/components/theme-picker";
import { WeightingForm } from "~/components/weighting-form";
import { themeValide } from "~/domain/themes";
import { isAdmin } from "~/server/auth/is-admin";
import { countPendingAnnouncements } from "~/server/db/queries/announcements";
import { getVitrine, jeuxCritiquesPar } from "~/server/db/queries/showcase";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

/**
 * Réglages — demandé par Victor.
 *
 * POURQUOI LES SORTIR DU PROFIL. Le profil mélangeait deux choses qui n'ont pas la même
 * durée de vie : ce qu'on est (son nom, ses avis, ce qu'on a écrit) et ce qu'on a réglé une
 * fois pour toutes (le thème, la pondération). Les seconds occupaient la moitié de l'écran
 * en permanence alors qu'on y touche trois fois par an — et repoussaient les avis, qui sont
 * la raison d'ouvrir la page, sous la ligne de flottaison.
 *
 * PAS D'ONGLET DÉDIÉ. La barre du bas en compte déjà cinq ; un sixième les rendrait
 * illisibles sur un téléphone, pour une page qu'on visite trois fois par an. On y arrive
 * depuis le profil, qui est l'endroit où on la cherche.
 */
export default async function ReglagesPage() {
  const reader = await getReaderContext();

  if (reader.userId === null) {
    return (
      <main className="flex flex-col gap-s4 p-s3">
        <div className="panneau flex flex-col items-start gap-s4 p-s5">
          <h1 className="font-display text-[25px] font-semibold">Réglages</h1>
          <p className="text-[13px] text-text-muted">
            Connecte-toi pour régler tes critères et tes couleurs.
          </p>
          <SignInButton />
        </div>
      </main>
    );
  }

  const enAttente = (await isAdmin(reader.userId))
    ? await countPendingAnnouncements()
    : 0;

  return (
    <main className="flex flex-col gap-s4 p-s3">
      <header className="panneau flex items-baseline justify-between gap-s4 p-s5">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          Réglages
        </h1>
        <Link
          href="/profile"
          className="shrink-0 text-[12px] text-text-muted underline decoration-dotted underline-offset-2"
        >
          Retour au profil
        </Link>
      </header>

      <ShowcaseForm
        jeux={await jeuxCritiquesPar(reader.userId)}
        initial={(await getVitrine(reader.userId)).map((e) => ({
          gameId: e.gameId,
          words: e.words,
        }))}
      />

      <WeightingForm initial={reader.weighting} />

      <ThemePicker actuel={themeValide((await cookies()).get("theme")?.value)} />

      {/*
        LE RÉGLAGE EXISTE MAINTENANT, et la position n'a pas changé — la fonctionnalité, oui.

        Hier je notais qu'un interrupteur pour les notifications de l'application n'aurait
        servi à rien : elles ne demandent aucune permission et ne dérangent personne, elles
        attendent dans un onglet. Les notifications du SYSTÈME dérangent vraiment : il y a une
        permission à donner, donc un réglage à offrir.
      */}
      <NotificationsSysteme />

      {/* Entretien réservé aux administrateurs. Ici plutôt que sur le profil : c'est une
          opération sur le site, pas quelque chose qui parle de soi. */}
      <AnnounceBacklog enAttente={enAttente} />
    </main>
  );
}
