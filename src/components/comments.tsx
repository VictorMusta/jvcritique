"use client";

import { useState, useTransition } from "react";

import type { RenderedSegment } from "~/domain/spoilers/render-for-audience";
import {
  addCommentAction,
  deleteCommentAction,
} from "~/server/actions/comment";
import { CommentEditor, type JeuMentionnable } from "./comment-editor";
import { SpoilerText, type TitresMentionnes } from "./spoiler-text";

/**
 * Fil de commentaires sous un Avis.
 *
 * Les segments sont préparés côté serveur par la fonction d'audience : un commentaire peut
 * contenir un spoiler `||…||` comme n'importe quel texte du produit, et il ne doit pas plus
 * s'afficher en clair ici qu'ailleurs. Le composant ne reçoit jamais de texte brut, ce qui
 * rend impossible de contourner le filtrage depuis cette surface (frontière 4).
 */
export type CommentForDisplay = {
  readonly id: string;
  readonly segments: readonly RenderedSegment[];
  readonly createdAt: string;
  readonly authorName: string;
  /** Vrai si le lecteur peut le supprimer : son auteur, ou un administrateur. */
  readonly canDelete: boolean;
};

export function Comments({
  reviewId,
  gameTitle,
  comments,
  canWrite,
  jeuxMentionnables = [],
  mentions = {},
}: {
  readonly reviewId: string;
  readonly gameTitle: string;
  readonly comments: readonly CommentForDisplay[];
  readonly canWrite: boolean;
  /** Le catalogue, pour l'autocomplétion des mentions. */
  readonly jeuxMentionnables?: readonly JeuMentionnable[];
  /** Titres des jeux déjà mentionnés, résolus côté serveur. */
  readonly mentions?: TitresMentionnes;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function envoyer() {
    setError(null);

    startTransition(async () => {
      const result = await addCommentAction(reviewId, body);

      if (result.ok) {
        setBody("");
      } else {
        setError(result.message);
      }
    });
  }

  function supprimer(commentId: string) {
    startTransition(async () => {
      const result = await deleteCommentAction(commentId, reviewId);

      if (!result.ok) {
        setError(result.message);
      }
    });
  }

  return (
    <section className="panneau flex flex-col gap-s4 p-s5">
      <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
        {comments.length === 0
          ? "Commentaires"
          : comments.length === 1
            ? "1 commentaire"
            : `${comments.length} commentaires`}
      </h2>

      {comments.map((comment) => (
        <article
          key={comment.id}
          className="flex flex-col gap-s2 rounded-[10px] border border-border bg-surface-raised p-s4"
        >
          <div className="flex items-baseline justify-between gap-s4">
            <p className="text-[12px] text-text-muted">
              <span className="text-text">{comment.authorName}</span> ·{" "}
              {comment.createdAt}
            </p>
            {comment.canDelete ? (
              <button
                type="button"
                onClick={() => supprimer(comment.id)}
                disabled={pending}
                className="text-[11px] text-text-muted underline decoration-dotted underline-offset-2 disabled:opacity-50"
              >
                Supprimer
              </button>
            ) : null}
          </div>
          <p className="text-[13px] leading-relaxed">
            <SpoilerText
              segments={comment.segments}
              gameTitle={gameTitle}
              mentions={mentions}
            />
          </p>
        </article>
      ))}

      {canWrite ? (
        <div className="flex flex-col gap-s3">
          <label htmlFor="commentaire" className="sr-only">
            Écrire un commentaire
          </label>
          <CommentEditor
            id="commentaire"
            valeur={body}
            onChange={setBody}
            jeux={jeuxMentionnables}
            disabled={pending}
          />
          <div className="flex items-center gap-s4">
            <button
              type="button"
              onClick={envoyer}
              disabled={pending || body.trim() === ""}
              className="rounded-[8px] border border-accent bg-accent px-s5 py-s3 text-[12px] font-semibold text-on-accent disabled:opacity-50"
            >
              {pending ? "Envoi…" : "Commenter"}
            </button>
            {/* Les deux syntaxes du champ, dites là où on écrit. */}
            <span className="text-[11px] italic leading-snug text-text-muted">
              Entoure un passage de || pour le masquer. Tape @ pour mentionner un jeu.
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-text-muted">
          Connecte-toi pour commenter.
        </p>
      )}

      {error ? (
        <p aria-live="polite" className="text-[12px] text-negative">
          {error}
        </p>
      ) : null}
    </section>
  );
}
