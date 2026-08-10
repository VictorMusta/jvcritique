import Link from "next/link";

import { SignInButton } from "~/components/auth-buttons";
import { isAdmin } from "~/server/auth/is-admin";
import { activiteGlobale } from "~/server/db/queries/activite-globale";
import {
  listerNotifications,
  marquerToutesLues,
} from "~/server/db/queries/notifications";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

const dateFormat: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
};

/**
 * Ce qui est arrivé à tes avis — FR-19, dans l'application.
 *
 * Demandé par Victor : être averti quand un avis reçoit un commentaire ou une réaction.
 *
 * LA LECTURE EST MARQUÉE À L'OUVERTURE, pas au clic sur une ligne. Ouvrir la liste, c'est
 * avoir vu ce qu'elle contient ; exiger un clic par ligne laisserait la pastille allumée sur
 * des évènements déjà lus, et on apprendrait à l'ignorer. Une pastille qu'on ignore ne sert
 * plus à rien.
 *
 * Les lignes déjà lues restent AFFICHÉES, simplement plus discrètes. Les faire disparaître
 * ferait perdre le fil à quelqu'un qui revient : « j'avais vu passer un commentaire, il est
 * où ? ».
 */
export default async function ActivitePage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const reader = await getReaderContext();

  if (reader.userId === null) {
    return (
      <main className="flex flex-col items-start gap-s4 p-s3">
        <div className="panneau flex flex-col items-start gap-s4 p-s5">
          <h1 className="font-display text-[25px] font-semibold">Ton activité</h1>
          <p className="text-[13px] text-text-muted">
            Connecte-toi pour voir ce qui arrive à tes avis.
          </p>
          <SignInButton />
        </div>
      </main>
    );
  }

  const admin = await isAdmin(reader.userId);

  /*
   * La vue globale est RÉSERVÉE AUX ADMINISTRATEURS, et le contrôle est ici plutôt que dans
   * l'affichage : un onglet masqué reste atteignable en tapant l'adresse. Quelqu'un qui pose
   * `?vue=globale` sans en avoir le droit retombe simplement sur ses notifications, sans
   * message — lui dire « réservé aux administrateurs » lui apprendrait qu'une vue existe.
   */
  const globale = admin && (await searchParams).vue === "globale";

  const notifications = globale ? [] : await listerNotifications(reader.userId);
  const evenements = globale ? await activiteGlobale() : [];

  /*
   * On ne marque comme lu QUE si l'on a effectivement regardé ses notifications.
   *
   * Sans cette condition, un administrateur qui ouvre la vue globale éteindrait sa pastille
   * sans avoir vu une seule de ses propres notifications — et elles seraient perdues, la
   * liste ne distinguant plus le nouveau de l'ancien.
   */
  if (!globale) {
    await marquerToutesLues(reader.userId);
  }

  return (
    <main className="flex flex-col gap-s4 p-s3">
      <div className="panneau flex flex-col gap-s4 p-s5">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          {globale ? "Tout le site" : "Ton activité"}
        </h1>

        {/*
          Les deux vues ne s'affichent QUE pour un administrateur. Pour les autres, un jeu
          d'onglets à une seule entrée serait un meuble vide — et Victor l'a dit clairement :
          « ça intéresse pas mes collègues ».
        */}
        {admin ? (
          <nav aria-label="Vue de l'activité" className="flex flex-wrap gap-s2">
            <Link
              href="/activite"
              aria-current={globale ? undefined : "page"}
              className={`rounded-full border px-s4 py-s2 text-[12px] ${
                globale
                  ? "border-border text-text-muted"
                  : "border-accent bg-accent font-semibold text-on-accent"
              }`}
            >
              Mes notifications
            </Link>
            <Link
              href="/activite?vue=globale"
              aria-current={globale ? "page" : undefined}
              className={`rounded-full border px-s4 py-s2 text-[12px] ${
                globale
                  ? "border-accent bg-accent font-semibold text-on-accent"
                  : "border-border text-text-muted"
              }`}
            >
              Tout le site
            </Link>
          </nav>
        ) : null}

        {globale ? (
          evenements.length === 0 ? (
            <p className="text-[12px] leading-snug text-text-muted">
              Rien encore. Les publications, commentaires et réactions apparaîtront ici.
            </p>
          ) : (
            <>
              {/*
                Mention nécessaire, pas décorative : sans elle, un administrateur croirait voir
                TOUT ce qui se passe, et conclurait à tort qu'une activité manquante n'a pas eu
                lieu.
              */}
              <p className="text-[11px] italic leading-snug text-text-muted">
                Les avis privés et tout ce qui s’y rattache sont exclus — être administrateur
                donne des pouvoirs d’entretien, pas un droit de regard.
              </p>
              <ul className="flex flex-col gap-s2">
                {evenements.map((e, index) => (
                  <li key={`${e.kind}-${e.reviewId}-${e.quand.toISOString()}-${index}`}>
                    <Link
                      href={`/review/${e.reviewId}`}
                      className="flex flex-col gap-[2px] rounded-[8px] border border-border bg-surface-raised p-s4"
                    >
                      <span className="text-[13px] leading-snug text-text">
                        <strong className="font-semibold">{e.qui}</strong>{" "}
                        {verbe(e.kind, e.detail)}{" "}
                        <strong className="font-semibold">{e.gameTitle}</strong>
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {e.quand.toLocaleDateString("fr-FR", dateFormat)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}

        {globale ? null : (
          <>
        {notifications.length === 0 ? (
          <p className="text-[12px] leading-snug text-text-muted">
            Rien pour l’instant. Ce que tes potes font sur tes avis — un commentaire, une
            réaction — apparaîtra ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-s2">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/review/${n.reviewId}`}
                  className={`flex flex-col gap-[2px] rounded-[8px] border p-s4 ${
                    n.lue
                      ? "border-border bg-surface-raised"
                      : // Non lue : le cadre d'accent suffit. Un fond différent en plus
                        // ferait crier la liste alors qu'elle doit se parcourir.
                        "border-accent bg-surface-raised"
                  }`}
                >
                  <span className="text-[13px] leading-snug text-text">
                    <strong className="font-semibold">{n.actorName}</strong>{" "}
                    {phrase(n.kind)} <strong className="font-semibold">{n.gameTitle}</strong>
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {n.createdAt.toLocaleDateString("fr-FR", dateFormat)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
          </>
        )}
      </div>
    </main>
  );
}

/**
 * Le verbe, sans jamais dire LAQUELLE des trois réactions a été posée.
 *
 * « Amandine n'est pas d'accord avec ton avis » se lit comme un reproche adressé
 * personnellement, alors que le bouton sert à nuancer. La page de l'avis montre le détail,
 * à un clic, dans son contexte — c'est-à-dire à côté des deux autres.
 */
function phrase(kind: "comment" | "reaction" | "edit"): string {
  switch (kind) {
    case "comment":
      return "a commenté ton avis sur";
    case "reaction":
      return "a réagi à ton avis sur";
    case "edit":
      return "a modifié ton avis sur";
  }
}

/**
 * Le verbe d'un évènement global.
 *
 * Ici la réaction DIT laquelle, contrairement aux notifications : celles-ci s'adressent à
 * l'auteur, et « untel n'est pas d'accord avec ton avis » se lit comme un reproche personnel.
 * Un administrateur qui regarde le site n'est pas le destinataire du jugement — il a besoin de
 * savoir ce qui s'est passé.
 */
function verbe(kind: "avis" | "commentaire" | "reaction", detail: string | null): string {
  switch (kind) {
    case "avis":
      return "a publié un avis sur";
    case "commentaire":
      return "a commenté un avis sur";
    case "reaction":
      return detail === "up"
        ? "a trouvé bon un avis sur"
        : "a trouvé mauvais un avis sur";
  }
}
