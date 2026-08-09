"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateGameAction } from "~/server/actions/game";

/**
 * Correction d'une fiche de jeu — titre et lien Steam. Visible des seuls administrateurs.
 *
 * Replié par défaut : sur une fiche de jeu, on vient lire des avis, pas administrer. Un
 * formulaire ouvert en permanence donnerait à l'entretien du catalogue une place qu'il ne
 * mérite pas.
 */
export function GameEditForm({
  gameId,
  initialTitle,
  initialSteamUrl,
}: {
  readonly gameId: string;
  readonly initialTitle: string;
  readonly initialSteamUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [steamUrl, setSteamUrl] = useState(initialSteamUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[12px] text-text-muted underline decoration-dotted underline-offset-2"
      >
        Corriger cette fiche
      </button>
    );
  }

  function save() {
    setFeedback(null);

    startTransition(async () => {
      const result = await updateGameAction(gameId, { title, steamUrl });

      if (result.ok) {
        setOpen(false);
        // Le titre change dans l'en-tête de la page : sans rafraîchissement, l'ancien
        // resterait affiché au-dessus du formulaire qu'on vient de valider.
        router.refresh();
      } else {
        setFeedback(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-s3 rounded-[10px] border border-border bg-surface p-s4">
      <label htmlFor="gameTitle" className="text-[12px] text-text-muted">
        Titre du jeu
      </label>
      <input
        id="gameTitle"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px]"
      />

      <label htmlFor="gameSteam" className="text-[12px] text-text-muted">
        Lien Steam
      </label>
      <input
        id="gameSteam"
        value={steamUrl}
        onChange={(e) => setSteamUrl(e.target.value)}
        placeholder="https://store.steampowered.com/app/…"
        className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px]"
      />

      {/* Mention porteuse : la correction vaut pour tout le monde, pas seulement ici. */}
      <p className="text-[12px] italic leading-snug text-text">
        Le titre change partout où ce jeu apparaît, y compris dans les avis déjà publiés.
        Les textes de tes potes ne sont pas touchés.
      </p>

      <div className="flex items-center gap-s4">
        <button
          type="button"
          onClick={save}
          disabled={pending || title.trim() === ""}
          className="rounded-[8px] border border-accent bg-accent px-s5 py-s3 text-[12px] font-semibold text-bg disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] text-text-muted"
        >
          Annuler
        </button>
      </div>

      {feedback ? (
        <p aria-live="polite" className="text-[12px] text-negative">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
