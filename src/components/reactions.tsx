"use client";

import { useState, useTransition } from "react";

import { reactionLabels } from "~/messages/fr";
import { reactAction } from "~/server/actions/reaction";
import type { Reaction, ReactionKind } from "~/server/db/queries/reviews";

const KINDS: ReactionKind[] = ["tempting", "sameHere", "disagree"];

/**
 * Réactions à un avis — trois boutons, une par personne.
 *
 * Ce n'est PAS un fil de commentaires, et le PRD le déclare en non-objectif. On garde le
 * signal social — « ton avis m'a donné envie » — sans créer de surface de modération, sans
 * appeler de notifications, et sans déplacer le produit vers la discussion.
 */
export function Reactions({
  reviewId,
  reactions,
  viewerId,
  isAuthor,
}: {
  readonly reviewId: string;
  readonly reactions: readonly Reaction[];
  readonly viewerId: string | null;
  readonly isAuthor: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // L'état local rend le clic instantané. Le serveur reste la source de vérité : au
  // rechargement, c'est lui qui gagne. Sans ça, chaque clic attendrait un aller-retour.
  const [mine, setMine] = useState<ReactionKind | null>(
    () => reactions.find((r) => r.userId === viewerId)?.kind ?? null,
  );

  const others = reactions.filter((r) => r.userId !== viewerId);

  function toggle(kind: ReactionKind) {
    const next = mine === kind ? null : kind;
    setMine(next);

    startTransition(async () => {
      const result = await reactAction(reviewId, next);

      // En cas d'échec on revient à l'état précédent : laisser un bouton allumé alors que
      // rien n'a été enregistré ferait croire à l'utilisateur qu'il a réagi.
      if (!result.ok) {
        setMine(mine);
      }
    });
  }

  return (
    <section className="flex flex-col gap-s3">
      {viewerId !== null && !isAuthor ? (
        <div className="flex flex-wrap gap-s2">
          {KINDS.map((kind) => {
            const active = mine === kind;

            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggle(kind)}
                disabled={pending}
                aria-pressed={active}
                className={`rounded-full border px-s4 py-s2 text-[12px] transition-colors disabled:opacity-60 ${
                  active
                    ? "border-accent bg-accent/15 font-semibold text-accent-text"
                    : "border-border text-text-muted"
                }`}
              >
                {reactionLabels[kind]}
              </button>
            );
          })}
        </div>
      ) : null}

      {/*
        Les NOMS, pas des compteurs.
        À cinq amis, « Paul et Marie » dit infiniment plus que « 2 ». Un compteur est la
        bonne abstraction quand la foule est anonyme ; ici ce sont des gens qu'on connaît, et
        savoir QUI a été tenté est précisément l'information utile.
      */}
      {others.length > 0 ? (
        <ul className="flex flex-col gap-[2px]">
          {KINDS.map((kind) => {
            const noms = others
              .filter((r) => r.kind === kind)
              .map((r) => r.userName ?? "Quelqu'un");

            if (noms.length === 0) {
              return null;
            }

            const liste =
              noms.length === 1
                ? noms[0]
                : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;

            return (
              <li key={kind} className="text-[12px] text-text-muted">
                <span className="text-text">{liste}</span> —{" "}
                {reactionLabels[kind].toLowerCase()}
              </li>
            );
          })}
        </ul>
      ) : null}

      {isAuthor && reactions.length === 0 ? (
        <p className="text-[11px] italic text-text-muted">
          Personne n&apos;a encore réagi à cet avis.
        </p>
      ) : null}
    </section>
  );
}
