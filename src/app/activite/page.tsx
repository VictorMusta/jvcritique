import Link from "next/link";

import { SignInButton } from "~/components/auth-buttons";
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
export default async function ActivitePage() {
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

  const notifications = await listerNotifications(reader.userId);

  // Après la lecture, jamais avant : marquer d'abord effacerait la distinction entre ce qui
  // était nouveau et ce qui ne l'était pas, sur la page même qui sert à la montrer.
  await marquerToutesLues(reader.userId);

  return (
    <main className="flex flex-col gap-s4 p-s3">
      <div className="panneau flex flex-col gap-s4 p-s5">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          Ton activité
        </h1>

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
