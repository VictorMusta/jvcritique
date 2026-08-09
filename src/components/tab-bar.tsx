"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Barre de navigation du bas.
 *
 * Le LIBELLÉ ACCOMPAGNE TOUJOURS L'ICÔNE — règle explicite de la spine, et sa justification
 * est concrète : les icônes de ce produit ne sont pas conventionnelles. Une fiole, un
 * grimoire, un alambic ne veulent rien dire hors contexte. Un onglet réduit à sa seule
 * icône n'est plus identifiable.
 *
 * Les libellés sont à 11 px, qui est un PLANCHER et non une cible : ils ne descendent
 * jamais en dessous et doivent survivre à un agrandissement du texte système.
 *
 * ELLE DISPARAÎT PENDANT LA SAISIE, et ce n'est pas une préférence d'affichage — c'est la
 * correction d'un défaut qui rendait le formulaire inutilisable sur téléphone.
 *
 * Signalé par Victor le 9 août 2026 : Leny touchait un champ de son avis et se retrouvait
 * sur l'onglet « Jeux ». Une barre en `position: fixed` est repositionnée par Android quand
 * le clavier s'ouvre : elle remonte au-dessus de lui, DONC sous le doigt encore posé. Le
 * relâchement tombe sur l'onglet qui vient de se glisser là. L'élément a bougé entre
 * l'appui et le clic — d'où l'impression que c'est impossible.
 *
 * La masquer supprime la cible au lieu d'essayer de la déplacer proprement, ce qu'aucune
 * mesure de hauteur de clavier ne fait de façon fiable d'un appareil à l'autre. Et écrire un
 * avis se passe très bien sans barre de navigation.
 */

/**
 * Vrai pour les champs qui OUVRENT LE CLAVIER, et pour eux seuls.
 *
 * Une case à cocher ou un curseur de note n'en ouvrent pas : masquer la barre à leur contact
 * la ferait clignoter tout au long de la notation, pour rien.
 */
function ouvreLeClavier(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  if (cible.isContentEditable) return true;
  if (cible instanceof HTMLTextAreaElement) return true;
  if (!(cible instanceof HTMLInputElement)) return false;

  return ["text", "search", "url", "number", "email", "tel", "password"].includes(
    cible.type,
  );
}

const items = [
  { href: "/", label: "Fil", glyph: "◈" },
  { href: "/publish", label: "Écrire", glyph: "✎" },
  { href: "/games", label: "Jeux", glyph: "◇" },
  { href: "/activite", label: "Activité", glyph: "◍" },
  { href: "/profile", label: "Profil", glyph: "◉" },
] as const;

export function TabBar({
  nonLues = 0,
}: {
  /** Notifications non lues, comptées côté serveur et descendues ici. */
  readonly nonLues?: number;
}) {
  const pathname = usePathname();

  /*
   * LA PASTILLE S'ÉTEINT DÈS QU'ON ARRIVE SUR L'ACTIVITÉ, sans attendre le serveur.
   *
   * Signalé par Victor : le compte restait affiché après avoir cliqué. Les notifications
   * étaient pourtant bien marquées lues en base — mais le compte est calculé dans la MISE EN
   * PAGE RACINE, qui ne se re-rend pas lors d'une navigation côté client. La pastille gardait
   * donc sa valeur jusqu'au prochain chargement complet.
   *
   * Corrigé ici plutôt que par un rafraîchissement forcé : celui-ci re-rendrait aussi la
   * liste, et les lignes perdraient leur cadre « nouveau » sous les yeux de celui qui vient
   * de les ouvrir. La pastille compte ce qui n'a pas été VU ; arriver sur la page, c'est
   * voir.
   *
   * L'état reste vrai pour le reste de la session, ce qui est correct : le prochain
   * chargement complet reprendra le compte réel, qui vaudra zéro.
   */
  const [activiteVue, setActiviteVue] = useState(pathname === "/activite");

  // Ajusté PENDANT le rendu et non dans un effet : c'est un état dérivé d'une propriété, le
  // cas que React prévoit explicitement. Dans un effet, la pastille resterait allumée le
  // temps d'un rendu de plus — visible, et sur l'écran même qui est censé l'éteindre.
  if (pathname === "/activite" && !activiteVue) {
    setActiviteVue(true);
  }

  const aSignaler = activiteVue ? 0 : nonLues;
  const [saisieEnCours, setSaisieEnCours] = useState(false);

  useEffect(() => {
    const entree = (evenement: FocusEvent) => {
      if (ouvreLeClavier(evenement.target)) {
        setSaisieEnCours(true);
      }
    };

    const sortie = () => {
      /*
       * Reporté d'un tour de boucle : au moment du `focusout`, `document.activeElement` vaut
       * encore `body`. Sans ce report, passer d'un champ au suivant ferait réapparaître la
       * barre une fraction de seconde — c'est-à-dire remettre la cible sous le doigt, au pire
       * moment possible.
       */
      setTimeout(() => {
        setSaisieEnCours(ouvreLeClavier(document.activeElement));
      }, 0);
    };

    document.addEventListener("focusin", entree);
    document.addEventListener("focusout", sortie);

    return () => {
      document.removeEventListener("focusin", entree);
      document.removeEventListener("focusout", sortie);
    };
  }, []);

  return (
    <nav
      aria-label="Navigation principale"
      /*
       * `hidden` et pas une simple transparence : un élément seulement invisible reste
       * cliquable et focalisable, ce qui laisserait le piège exactement en place.
       */
      hidden={saisieEnCours}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface"
    >
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ href, label, glyph }) => {
          // Le fil est à la racine : sans le cas particulier, tout chemin commencerait par
          // « / » et les quatre onglets seraient actifs en même temps.
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-[2px] py-2 ${
                  active ? "text-accent-text" : "text-text-muted"
                }`}
              >
                <span aria-hidden className="relative text-base leading-none">
                  {glyph}
                  {/*
                    LA PASTILLE PORTE LE NOMBRE, pas un simple point.
                    « 3 » dit s'il vaut la peine d'ouvrir tout de suite ; un point ne dit que
                    « quelque chose ». Au-delà de neuf, le compte exact n'aide plus personne
                    et la pastille déborderait de l'icône.
                  */}
                  {href === "/activite" && aSignaler > 0 ? (
                    <span className="tnum absolute -right-[9px] -top-[5px] min-w-[15px] rounded-full bg-accent px-[3px] text-center text-[9px] font-bold leading-[15px] text-on-accent">
                      {aSignaler > 9 ? "9+" : aSignaler}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] font-semibold leading-tight">
                  {label}
                  {/* Le compte est répété pour qui écoute la page : la pastille est
                      décorative, et un lecteur d'écran ne l'annoncerait jamais. */}
                  {href === "/activite" && aSignaler > 0 ? (
                    <span className="sr-only">
                      {" "}
                      — {aSignaler} {aSignaler === 1 ? "nouveauté" : "nouveautés"}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
