"use client";

import { useState, useTransition } from "react";

import { addUpdateNoteAction } from "~/server/actions/review-edit";

/**
 * Ajouter une Note de mise à jour — FR-10.
 *
 * Visible seulement pour l'auteur de l'avis : ce n'est pas un fil de commentaires. La
 * vérification qui compte est côté serveur (l'action refuse si l'avis n'est pas le sien) ;
 * masquer le formulaire aux autres n'est qu'une politesse d'interface.
 */
export function UpdateNoteForm({ reviewId }: { readonly reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-[8px] border border-border px-s4 py-s2 text-[12px] text-text-muted"
      >
        Ajouter une note de mise à jour
      </button>
    );
  }

  function submit() {
    setError(null);

    startTransition(async () => {
      const result = await addUpdateNoteAction(reviewId, body);

      if (result.ok) {
        setBody("");
        setOpen(false);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-s3 rounded-[10px] border border-border bg-surface-raised p-s4">
      <label htmlFor="updateNote" className="text-[12px] text-text-muted">
        Ce qui a changé depuis
      </label>
      <textarea
        id="updateNote"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Le patch 0.220 a ajouté les Mistlands, et ça change beaucoup de choses…"
        className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px] leading-relaxed"
      />
      {/* FR-10 : ajouter une note n'altère pas les notes chiffrées. Le dire évite que
          l'auteur s'attende à voir sa note bouger. */}
      <p className="text-[11px] italic text-text-muted">
        Ça n&apos;change ni ton texte d&apos;origine ni tes notes. Pour les ajuster, modifie
        l&apos;avis.
      </p>
      <div className="flex items-center gap-s4">
        <button
          type="button"
          onClick={submit}
          disabled={pending || body.trim() === ""}
          className="rounded-[8px] border border-accent bg-accent px-s5 py-s3 text-[12px] font-semibold text-on-accent disabled:opacity-50"
        >
          {pending ? "Ajout…" : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] text-text-muted"
        >
          Annuler
        </button>
      </div>
      {error ? (
        <p aria-live="polite" className="text-[12px] text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
