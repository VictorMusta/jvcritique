"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useVeilleNotifications } from "./veille-notifications";

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

/**
 * Les icônes, choisies par Victor sur maquette le 10 août 2026 — jeu « trait fin ».
 *
 * ELLES REMPLACENT DES GLYPHES TYPOGRAPHIQUES qui ne se distinguaient presque pas les uns des
 * autres et dont aucun ne disait ce qu'il désignait. Une maison, un crayon, un dé, une cloche
 * et une silhouette se reconnaissent sans apprentissage.
 *
 * LE LIBELLÉ RESTE, mais sa justification a changé. La règle d'origine disait que les icônes du
 * produit n'étaient pas conventionnelles et ne pouvaient donc pas se passer de leur mot.
 * Celles-ci le sont. Ils restent quand même : à cinq amis dont personne n'a lu de mode
 * d'emploi, un mot de onze pixels coûte moins cher qu'une hésitation.
 *
 * Dessinées à la main plutôt que tirées d'une bibliothèque : cinq icônes ne valent pas une
 * dépendance, ni les kilooctets qu'elle ferait charger à chaque visite.
 */
const traits = {
  // `1.7` et non `2` : à 21 px, un trait de 2 px empâte les angles du dé et de la maison.
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Maison() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...traits}>
      <path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function Crayon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...traits}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function De() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...traits}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      {/* Les points sont PLEINS : à cette taille, un cercle en trait de 1,7 px se remplit
          visuellement de lui-même et devient une tache floue. */}
      {[
        [8.5, 8.5],
        [15.5, 8.5],
        [12, 12],
        [8.5, 15.5],
        [15.5, 15.5],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.1} fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

function Cloche() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...traits}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function Silhouette() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...traits}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const items = [
  { href: "/", label: "Fil", Icone: Maison },
  { href: "/publish", label: "Écrire", Icone: Crayon },
  { href: "/games", label: "Jeux", Icone: De },
  { href: "/activite", label: "Activité", Icone: Cloche },
  { href: "/profile", label: "Profil", Icone: Silhouette },
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
  /*
   * LE COMPTE VIENT DÉSORMAIS D'UNE SURVEILLANCE, plus seulement du rendu serveur.
   *
   * La propriété reçue sert d'amorce, pour que la pastille soit juste au premier affichage
   * sans attendre la première interrogation. Ensuite c'est la veille qui a raison : elle voit
   * arriver une notification sans qu'on ait rechargé, ce que Victor demandait.
   */
  const compte = useVeilleNotifications(nonLues);

  /*
   * L'extinction locale est CONSERVÉE malgré la surveillance, et pour une raison de délai.
   *
   * Arriver sur l'activité marque tout comme lu côté serveur, mais l'interrogation suivante
   * peut être à trente secondes : sans cette extinction immédiate, la pastille resterait
   * allumée sur l'écran même qui vient de la vider.
   *
   * Elle est RELÂCHÉE dès que la surveillance annonce plus que ce qu'on avait éteint — sinon
   * une notification arrivée après la visite ne s'afficherait plus jamais. C'était le défaut
   * de la version précédente, où le verrou tenait toute la session.
   */
  const [eteintA, setEteintA] = useState<number | null>(
    pathname === "/activite" ? 0 : null,
  );

  if (pathname === "/activite" && eteintA === null) {
    setEteintA(0);
  }

  const aSignaler = eteintA !== null && compte <= eteintA ? 0 : compte;
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
        {items.map(({ href, label, Icone }) => {
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
                <span aria-hidden className="relative leading-none">
                  <Icone />
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
