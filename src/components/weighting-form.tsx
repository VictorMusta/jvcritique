"use client";

import { useState, useTransition } from "react";

import { DOMAIN_KEYS, type DomainKey, type Weighting } from "~/domain/types";
import { bearingHints, domainLabels } from "~/messages/fr";
import { saveWeightingAction } from "~/server/actions/weighting";

/**
 * Réglage de la Pondération — FR-2.
 *
 * Sept curseurs de 0 à 100. Un domaine à zéro est exclu du calcul du lecteur, mais reste
 * visible à la lecture : la pondération dit ce qui COMPTE pour toi, pas ce que tu veux
 * cacher.
 */
export function WeightingForm({ initial }: { readonly initial: Weighting }) {
  // Un domaine sans valeur enregistrée démarre à 50 : un défaut neutre, plutôt que zéro qui
  // l'exclurait silencieusement du calcul sans que l'utilisateur l'ait demandé.
  const [values, setValues] = useState<Record<DomainKey, number>>(() => {
    const start = {} as Record<DomainKey, number>;
    for (const key of DOMAIN_KEYS) {
      start[key] = initial[key] ?? 50;
    }
    return start;
  });

  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function save() {
    setFeedback(null);

    startTransition(async () => {
      const result = await saveWeightingAction(
        DOMAIN_KEYS.map((domain) => ({ domain, weight: values[domain] })),
      );

      // Le type `Result` rend l'échec nommable : on affiche le message français qu'il
      // porte, jamais une exception brute.
      setFeedback(result.ok ? "Tes critères sont enregistrés." : result.message);
    });
  }

  return (
    <section className="flex flex-col gap-s5">
      <div className="flex flex-col gap-s2">
        <h2 className="font-display text-[15px] font-semibold">Tes critères</h2>
        {/* Mention PORTEUSE : elle énonce une règle de calcul, donc pleine couleur et
            jamais atténuée (DESIGN.md). */}
        <p className="text-[12px] italic leading-snug text-text">
          {bearingHints.weightingZero}
        </p>
      </div>

      <div className="flex flex-col">
        {DOMAIN_KEYS.map((domain) => (
          <div key={domain} className="flex flex-col">
            <div className="flex items-baseline justify-between gap-s4">
              <label
                htmlFor={`weight-${domain}`}
                className="text-[12px] text-text-muted"
              >
                {domainLabels[domain]}
              </label>
              <span className="tnum text-[12px] font-semibold">
                {values[domain]}
              </span>
            </div>
            <input
              id={`weight-${domain}`}
              className="domain-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={values[domain]}
              onChange={(event) =>
                setValues((previous) => ({
                  ...previous,
                  [domain]: Number(event.target.value),
                }))
              }
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-s4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[8px] border border-accent bg-accent px-s5 py-[13px] font-semibold text-bg disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer mes critères"}
        </button>
        {feedback ? (
          <p aria-live="polite" className="text-[12px] text-text-muted">
            {feedback}
          </p>
        ) : null}
      </div>
    </section>
  );
}
