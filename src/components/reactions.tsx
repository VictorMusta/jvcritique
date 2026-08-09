"use client";

import { useState, useTransition } from "react";

import { reactionLabels } from "~/messages/fr";
import { reactAction } from "~/server/actions/reaction";
import { todoAction } from "~/server/actions/todo";
import type { Reaction, ReactionKind } from "~/server/db/queries/reviews";

const KINDS: ReactionKind[] = ["up", "down"];

/**
 * Réactions à un avis, et liste de jeux à faire.
 *
 * TROIS BOUTONS QUI NE FONT PLUS LA MÊME CHOSE, et c'est le point délicat de cet écran.
 * Les deux pouces jugent l'AVIS, s'excluent l'un l'autre, et sont visibles de son auteur.
 * « À faire » porte sur le JEU, est cumulable avec un pouce, et n'est visible de personne
 * d'autre. Ils se ressemblent parce qu'ils sont côte à côte, pas parce qu'ils sont de même
 * nature — d'où le séparateur qui les éloigne.
 *
 * Refonte demandée par Victor le 10 août 2026 : « ça me tente » était une intention
 * personnelle déguisée en réaction.
 */
export function Reactions({
  reviewId,
  gameId,
  reactions,
  viewerId,
  isAuthor,
  dejaDansLaListe = false,
}: {
  readonly reviewId: string;
  /** La liste porte sur le JEU, pas sur l'avis qui a donné envie d'y jouer. */
  readonly gameId: string;
  readonly reactions: readonly Reaction[];
  readonly viewerId: string | null;
  readonly isAuthor: boolean;
  readonly dejaDansLaListe?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [dansLaListe, setDansLaListe] = useState(dejaDansLaListe);

  function basculerListe() {
    const avant = dansLaListe;
    setDansLaListe(!avant);

    startTransition(async () => {
      const result = await todoAction(gameId);

      // Comme pour les réactions : en cas d'échec on revient en arrière, sinon le bouton
      // resterait allumé sur un ajout qui n'a pas eu lieu.
      if (result.ok) {
        setDansLaListe(result.data.dansLaListe);
      } else {
        setDansLaListe(avant);
      }
    });
  }

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
      {viewerId !== null ? (
        <div className="flex flex-wrap items-center gap-s2">
          {/*
            « À FAIRE » RESTE OFFERT À L'AUTEUR, contrairement aux pouces. Se juger soi-même
            n'a pas de sens ; vouloir rejouer à un jeu dont on a parlé en a parfaitement.
          */}
          <button
            type="button"
            onClick={basculerListe}
            disabled={pending}
            aria-pressed={dansLaListe}
            className={`flex items-center gap-s2 rounded-full border px-s4 py-s2 text-[12px] transition-colors disabled:opacity-60 ${
              dansLaListe
                ? "border-accent bg-accent/15 font-semibold text-accent-text"
                : "border-border text-text-muted"
            }`}
          >
            <span aria-hidden>{dansLaListe ? "✓" : "+"}</span>
            {dansLaListe ? "Dans ma liste" : "Ajouter à ma liste"}
          </button>

          {/* Séparateur : ce qui suit juge l'avis, ce qui précède ne regarde que soi. */}
          {!isAuthor ? (
            <span aria-hidden className="text-text-muted opacity-50">
              ·
            </span>
          ) : null}
        </div>
      ) : null}

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
