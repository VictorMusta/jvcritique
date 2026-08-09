"use client";

import { useTransition } from "react";

import { THEMES, type ThemeId } from "~/domain/themes";
import { setThemeAction } from "~/server/actions/theme";

/**
 * Choix de la variante de couleurs — FR-20.
 *
 * Chaque option est affichée AVEC SES PROPRES COULEURS, en trois pastilles : fond, surface,
 * accent. Une liste de noms obligerait à essayer chaque thème pour savoir à quoi il
 * ressemble ; ici on choisit en regardant, ce qui est le geste naturel pour une couleur.
 */
export function ThemePicker({ actuel }: { readonly actuel: ThemeId }) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-s4">
      <div className="flex flex-col gap-s2">
        <h2 className="font-display text-[15px] font-semibold">Les couleurs</h2>
        <p className="text-[11px] italic text-text-muted">
          Le choix reste sur cet appareil. Tu peux en avoir un sur ton téléphone et un autre
          sur ton ordinateur.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-s2">
        {THEMES.map((theme) => {
          const choisi = theme.id === actuel;

          return (
            <li key={theme.id}>
              <button
                type="button"
                disabled={pending}
                aria-pressed={choisi}
                onClick={() =>
                  startTransition(async () => {
                    await setThemeAction(theme.id);
                  })
                }
                /*
                 * `data-theme` sur le bouton lui-même : les variables de la variante
                 * s'appliquent à son sous-arbre, donc les pastilles affichent les vraies
                 * couleurs du thème qu'elles proposent, sans qu'on ait à les recopier ici.
                 * Une couleur recopiée finit toujours par diverger de sa source.
                 */
                data-theme={theme.id}
                className={`flex w-full items-center gap-s3 rounded-[8px] border p-s3 text-left disabled:opacity-60 ${
                  choisi ? "border-accent" : "border-border"
                }`}
                style={{ backgroundColor: "var(--color-surface)" }}
              >
                <span className="flex shrink-0 gap-[3px]" aria-hidden>
                  {(["--color-bg", "--color-surface-raised", "--color-accent"] as const).map(
                    (variable) => (
                      <span
                        key={variable}
                        className="h-[18px] w-[10px] rounded-[3px] border border-border"
                        style={{ backgroundColor: `var(${variable})` }}
                      />
                    ),
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className="truncate text-[12px] font-semibold"
                    style={{ color: "var(--color-text)" }}
                  >
                    {theme.label}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {theme.mode}
                    {choisi ? " · choisi" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
