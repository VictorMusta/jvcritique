"use client";

import { useState, useTransition } from "react";

import { THEMES, THEME_PAR_DEFAUT, type ThemeId } from "~/domain/themes";
import { setThemeAction } from "~/server/actions/theme";

/**
 * Accueil à la première connexion — on demande son jeu préféré, et la couleur suit.
 *
 * LE CADRAGE EST LE POINT IMPORTANT. « Choisis un thème » est une question d'interface, à
 * laquelle on répond au hasard faute d'enjeu. « Quel est ton jeu préféré ? » est une
 * question sur soi, à laquelle on a une réponse — et elle parle du produit dès la première
 * seconde. La couleur n'est que la conséquence de la réponse.
 *
 * Ne s'affiche que pour quelqu'un de connecté qui n'a fait aucun choix sur cet appareil.
 * Sur un second téléphone, la question revient : cinq secondes, et le résultat est juste.
 */

/** Les cinq univers, en mode sombre — D13 impose le sombre aux nouveaux venus. */
const UNIVERS = THEMES.filter((t) => t.mode === "sombre");

export function ThemeOnboarding() {
  const [ferme, setFerme] = useState(false);
  const [choisi, setChoisi] = useState<ThemeId | null>(null);
  const [pending, startTransition] = useTransition();

  if (ferme) {
    return null;
  }

  /**
   * Applique la variante TOUT DE SUITE, avant d'aller la persister.
   *
   * L'attribut est posé sur le document par le client : l'animation part au moment du clic,
   * pas au retour du serveur. Attendre l'aller-retour rendrait le geste mou, et c'est
   * précisément le moment où le produit doit paraître vivant.
   */
  function appliquer(id: ThemeId) {
    const racine = document.documentElement;

    // La transition n'est active QUE pendant le changement. La laisser en permanence
    // ferait traîner chaque navigation dans un fondu inutile.
    racine.classList.add("theme-transition");
    // `setAttribute` plutôt qu'une affectation sur `dataset` : l'API explicite passe pour ce
    // qu'elle est — un appel au DOM — là où l'affectation ressemble à une mutation d'état.
    racine.setAttribute("data-theme", id);
    setChoisi(id);

    window.setTimeout(() => racine.classList.remove("theme-transition"), 600);

    startTransition(async () => {
      await setThemeAction(id);
      // On laisse la couleur s'installer avant de refermer : fermer aussitôt escamoterait
      // l'effet qu'on vient de produire.
      window.setTimeout(() => setFerme(true), 900);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 p-s5">
      <div className="flex w-full max-w-md flex-col gap-s5">
        <div className="flex flex-col gap-s2 text-center">
          <h2 className="font-display text-[25px] font-semibold leading-tight">
            {choisi ? "Parfait." : "Ton jeu préféré, c'est lequel ?"}
          </h2>
          <p className="text-[12px] text-text-muted">
            {choisi
              ? "jvcritiqué prend ses couleurs. Tu pourras en changer dans ton profil."
              : "On habille jvcritiqué à ses couleurs. Ça se rechange quand tu veux."}
          </p>
        </div>

        {!choisi ? (
          <>
            <ul className="flex flex-col gap-s2">
              {UNIVERS.map((univers) => (
                <li key={univers.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => appliquer(univers.id)}
                    /*
                     * `data-theme` sur le bouton : chaque option se montre dans SES propres
                     * couleurs, héritées de la variante qu'elle propose. Aucune couleur
                     * n'est recopiée ici — une couleur recopiée finit par diverger.
                     */
                    data-theme={univers.id}
                    className="flex w-full items-center gap-s4 rounded-[10px] border border-border p-s4 text-left transition-transform active:scale-[0.99] disabled:opacity-60"
                    style={{ backgroundColor: "var(--color-surface)" }}
                  >
                    <span className="flex shrink-0 gap-[3px]" aria-hidden>
                      {(
                        ["--color-bg", "--color-surface-raised", "--color-accent"] as const
                      ).map((variable) => (
                        <span
                          key={variable}
                          className="h-[26px] w-[12px] rounded-[3px] border border-border"
                          style={{ backgroundColor: `var(${variable})` }}
                        />
                      ))}
                    </span>
                    <span
                      className="font-display text-[15px] font-semibold"
                      style={{ color: "var(--color-text)" }}
                    >
                      {univers.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={pending}
              onClick={() => {
                // Passer doit ENREGISTRER le défaut, sinon la question reviendrait à chaque
                // visite — et une question qu'on a déjà déclinée devient vite agaçante.
                startTransition(async () => {
                  await setThemeAction(THEME_PAR_DEFAUT);
                  setFerme(true);
                });
              }}
              className="self-center text-[12px] text-text-muted underline decoration-dotted underline-offset-2"
            >
              Aucun de ceux-là
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
