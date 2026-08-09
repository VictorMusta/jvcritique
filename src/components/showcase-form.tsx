"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { enregistrerVitrineAction } from "~/server/actions/showcase";

/**
 * Réglage de la vitrine du profil — le « top 5 » demandé par Victor.
 *
 * CINQ EMPLACEMENTS TOUJOURS VISIBLES, vides compris. Un bouton « ajouter une ligne »
 * cacherait la seule chose qu'on a besoin de savoir en arrivant : combien de places il
 * reste, et dans quel ordre elles vont sortir.
 *
 * L'ORDRE DU FORMULAIRE EST L'ORDRE DE LA VITRINE. Aucun champ « position » : un numéro
 * saisi à côté finit toujours par contredire ce qu'on voit. Les emplacements laissés vides
 * sont simplement retirés, et les suivants remontent.
 */
export function ShowcaseForm({
  jeux,
  initial,
}: {
  /** Les jeux que la personne a critiqués — les seuls qu'elle puisse mettre en avant. */
  readonly jeux: readonly { gameId: string; title: string }[];
  readonly initial: readonly { gameId: string; words: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retour, setRetour] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const [lignes, setLignes] = useState<{ gameId: string; words: string }[]>(() =>
    Array.from({ length: 5 }, (_, i) => initial[i] ?? { gameId: "", words: "" }),
  );

  function modifier(index: number, champ: "gameId" | "words", valeur: string) {
    setLignes((actuelles) =>
      actuelles.map((l, i) => (i === index ? { ...l, [champ]: valeur } : l)),
    );
  }

  function enregistrer() {
    setRetour(null);
    setErreur(null);

    // Une ligne sans jeu n'existe pas. Une ligne avec un jeu et sans mots serait refusée par
    // le serveur : on la signale ici plutôt que de laisser partir un aller-retour perdu.
    const retenues = lignes
      .filter((l) => l.gameId !== "")
      .map((l) => ({ gameId: l.gameId, words: l.words.trim() }));

    if (retenues.some((l) => l.words === "")) {
      setErreur("Chaque jeu retenu demande quelques mots pour le décrire.");
      return;
    }

    startTransition(async () => {
      const result = await enregistrerVitrineAction(retenues);

      if (result.ok) {
        setRetour("Vitrine enregistrée.");
        // Le profil affiche la vitrine : sans ça, on y retrouverait l'ancienne.
        router.refresh();
      } else {
        setErreur(result.message);
      }
    });
  }

  if (jeux.length === 0) {
    return (
      <section className="panneau flex flex-col gap-s3 p-s5">
        <h2 className="font-display text-[15px] font-semibold">Ma vitrine</h2>
        <p className="text-[12px] leading-snug text-text-muted">
          Elle se remplit avec des jeux que tu as critiqués — écris un premier avis et ils
          apparaîtront ici.
        </p>
      </section>
    );
  }

  return (
    <section className="panneau flex flex-col gap-s4 p-s5">
      <div className="flex flex-col gap-s2">
        <h2 className="font-display text-[15px] font-semibold">Ma vitrine</h2>
        <p className="text-[11px] italic leading-snug text-text-muted">
          Cinq jeux en tête de ton profil, dans l’ordre que tu choisis. Trois mots suffisent
          — c’est ce qui les rend lisibles d’un coup d’œil.
        </p>
      </div>

      {lignes.map((ligne, index) => (
        <div key={index} className="flex flex-col gap-s2">
          <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
            {index + 1}
            <sup>{index === 0 ? "er" : "e"}</sup>
          </span>

          <label htmlFor={`vitrine-jeu-${index}`} className="sr-only">
            Jeu à la place {index + 1}
          </label>
          <select
            id={`vitrine-jeu-${index}`}
            value={ligne.gameId}
            onChange={(e) => modifier(index, "gameId", e.target.value)}
            className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px]"
          >
            <option value="">— laisser vide —</option>
            {jeux.map((jeu) => (
              <option key={jeu.gameId} value={jeu.gameId}>
                {jeu.title}
              </option>
            ))}
          </select>

          <label htmlFor={`vitrine-mots-${index}`} className="sr-only">
            Trois mots pour la place {index + 1}
          </label>
          <input
            id={`vitrine-mots-${index}`}
            value={ligne.words}
            onChange={(e) => modifier(index, "words", e.target.value)}
            maxLength={60}
            placeholder="âpre, injuste, inoubliable"
            className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px]"
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-s4">
        <button
          type="button"
          onClick={enregistrer}
          disabled={pending}
          className="rounded-[8px] bg-accent px-s5 py-s3 text-[13px] font-semibold text-on-accent disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer ma vitrine"}
        </button>
        {retour !== null ? (
          <span aria-live="polite" className="text-[12px] text-text-muted">
            {retour}
          </span>
        ) : null}
      </div>

      {erreur !== null ? (
        <p aria-live="polite" className="text-[12px] leading-snug text-negative">
          {erreur}
        </p>
      ) : null}
    </section>
  );
}
