"use client";

import { useState, useTransition } from "react";

import { annoncerLeRetardAction } from "~/server/actions/announce";

/**
 * Rattrapage des annonces Discord — visible des seuls administrateurs.
 *
 * Le compte est affiché AVANT le clic, et c'est le point important : le geste écrit dans un
 * salon que cinq personnes lisent, et un message Discord ne se reprend pas. Un bouton
 * « Annoncer » sans nombre demanderait d'appuyer sans savoir combien de messages partent.
 */
export function AnnounceBacklog({ enAttente }: { readonly enAttente: number }) {
  const [restants, setRestants] = useState(enAttente);
  const [pending, startTransition] = useTransition();
  const [retour, setRetour] = useState<string | null>(null);

  if (restants === 0) {
    return null;
  }

  function envoyer() {
    setRetour(null);

    startTransition(async () => {
      const result = await annoncerLeRetardAction();

      if (!result.ok) {
        setRetour(result.message);
        return;
      }

      const { envoyes, restants: reste } = result.data;
      setRestants(reste);
      setRetour(
        envoyes === 0
          ? "Rien n’est parti — Discord a refusé. Le webhook est peut-être périmé."
          : `${envoyes} annonce${envoyes > 1 ? "s" : ""} envoyée${envoyes > 1 ? "s" : ""}.` +
              (reste > 0 ? ` Il en reste ${reste}, reclique pour la suite.` : ""),
      );
    });
  }

  return (
    <div className="flex flex-col gap-s3 rounded-[10px] border border-border bg-surface p-s4">
      <p className="text-[13px] leading-snug text-text">
        <strong className="font-semibold">{restants}</strong>{" "}
        {restants > 1 ? "avis publics n'ont" : "avis public n'a"} jamais été annoncé dans
        Discord.
      </p>

      <p className="text-[12px] italic leading-snug text-text-muted">
        Du plus ancien au plus récent, pour que le salon se lise dans l’ordre. Un avis déjà
        annoncé ne repart jamais.
      </p>

      <button
        type="button"
        onClick={envoyer}
        disabled={pending}
        className="self-start rounded-[8px] bg-accent px-s4 py-s3 text-[13px] font-semibold text-on-accent disabled:opacity-60"
      >
        {pending ? "Envoi en cours…" : `Annoncer ${Math.min(restants, 12)} avis`}
      </button>

      {retour !== null && (
        <p className="text-[12px] leading-snug text-text-muted">{retour}</p>
      )}
    </div>
  );
}
