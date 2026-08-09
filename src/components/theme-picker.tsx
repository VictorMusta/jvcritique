"use client";

import { useTransition } from "react";

import { THEMES, type ThemeId } from "~/domain/themes";
import { setThemeAction } from "~/server/actions/theme";

/**
 * Choix de la variante de couleurs — FR-20.
 *
 * Chaque option est affichée AVEC SES PROPRES COULEURS — trois pastilles et, depuis le
 * 9 août 2026, LA TEXTURE DE FOND du thème qu'elle propose. Une liste de noms obligerait à
 * essayer chaque thème pour savoir à quoi il ressemble ; ici on choisit en regardant, ce qui
 * est le geste naturel pour une couleur.
 *
 * La texture vient de la même variable `--texture` que le fond du site, lue depuis le
 * `data-theme` porté par le bouton. Ce n'est pas une vignette : une imitation finirait par
 * mentir le jour où l'on retouche une géométrie.
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
                className={`theme-option relative flex w-full items-center gap-s3 overflow-hidden rounded-[10px] border p-s4 text-left disabled:opacity-60 ${
                  choisi ? "border-2 border-accent" : "border-border"
                }`}
                /*
                 * Le fond est celui de la PAGE, pas d'une carte : c'est ce que le bouton
                 * propose de regarder. La texture se pose dessus via `.theme-option`, et
                 * une hauteur plus genereuse lui laisse la place de se lire.
                 */
                style={{ backgroundColor: "var(--color-bg)", minHeight: "64px" }}
              >
                <span className="relative flex shrink-0 gap-[3px]" aria-hidden>
                  {(["--color-bg", "--color-surface-raised", "--color-accent"] as const).map(
                    (variable) => (
                      <span
                        key={variable}
                        className="h-[30px] w-[11px] rounded-[3px] border border-border"
                        style={{ backgroundColor: `var(${variable})` }}
                      />
                    ),
                  )}
                </span>
                <span className="relative flex min-w-0 flex-col">
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
