"use client";

import { useMemo, useRef, useState } from "react";

import { comparable } from "~/domain/comparable";
import { ecrireMention } from "~/domain/mentions";

/**
 * Champ de commentaire avec mention d'un jeu par `@` — demandé par Victor.
 *
 * L'AUTOCOMPLÉTION EST OBLIGATOIRE, et ce n'est pas une commodité : elle est le seul chemin
 * qui existe pour créer une mention. Le texte enregistré contient un identifiant, pas un
 * titre ; personne ne peut le taper de mémoire, et personne ne devrait avoir à le faire.
 *
 * C'est aussi ce qui applique la règle de Victor — « si le jeu n'a pas d'avis posé, on peut
 * pas ». La liste proposée est le catalogue, et le catalogue naît des avis : un jeu dont
 * personne n'a parlé n'y figure pas, donc ne peut pas être mentionné.
 *
 * LE DÉCLENCHEUR EST L'ARROBASE SUIVIE DE LETTRES, jusqu'au curseur. On ne cherche pas dans
 * tout le texte : quelqu'un qui a mentionné un jeu au début de son commentaire ne doit pas
 * voir la liste se rouvrir à chaque touche tapée trente mots plus loin.
 */

export type JeuMentionnable = { readonly id: string; readonly title: string };

/** Ce que l'utilisateur est en train de taper après une arobase, s'il l'est. */
function requeteEnCours(texte: string, curseur: number): { debut: number; terme: string } | null {
  const avant = texte.slice(0, curseur);

  /*
   * L'arobase doit ouvrir un mot : précédée d'une lettre, elle appartient à autre chose —
   * une adresse de courriel, un pseudonyme. Sans cette condition, taper un courriel ferait
   * surgir la liste des jeux.
   */
  const trouve = /(?:^|\s)@([\p{L}\p{N} '’:!-]{0,40})$/u.exec(avant);

  if (trouve === null) {
    return null;
  }

  const terme = trouve[1] ?? "";

  return { debut: curseur - terme.length - 1, terme };
}

export function CommentEditor({
  valeur,
  onChange,
  jeux,
  id,
  disabled,
}: {
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
  readonly jeux: readonly JeuMentionnable[];
  readonly id: string;
  readonly disabled?: boolean;
}) {
  const champ = useRef<HTMLTextAreaElement>(null);
  const [curseur, setCurseur] = useState(0);
  const [choisi, setChoisi] = useState(0);

  const requete = useMemo(() => requeteEnCours(valeur, curseur), [valeur, curseur]);

  const propositions = useMemo(() => {
    if (requete === null) return [];

    const terme = comparable(requete.terme.trim());

    // Une arobase seule propose déjà quelque chose : c'est ainsi qu'on découvre que la
    // fonctionnalité existe. Attendre une lettre la rendrait invisible.
    const filtres =
      terme === ""
        ? jeux
        : jeux.filter((j) => comparable(j.title).includes(terme));

    // Cinq au plus : une liste plus longue recouvrirait le champ sur un téléphone.
    return filtres.slice(0, 5);
  }, [jeux, requete]);

  function inserer(jeu: JeuMentionnable) {
    if (requete === null) return;

    const avant = valeur.slice(0, requete.debut);
    const apres = valeur.slice(curseur);
    // Une espace après la mention : sans elle, le mot suivant se collerait à l'identifiant,
    // et l'autocomplétion se rouvrirait sur ce qu'on tape juste après.
    const nouveau = `${avant}${ecrireMention(jeu.id)} ${apres}`;

    onChange(nouveau);
    setChoisi(0);

    // Le curseur est replacé APRÈS l'insertion, sinon il reste là où il était et la frappe
    // suivante atterrit au milieu de l'identifiant.
    const position = avant.length + ecrireMention(jeu.id).length + 1;
    requestAnimationFrame(() => {
      champ.current?.setSelectionRange(position, position);
      setCurseur(position);
    });
  }

  const ouverte = propositions.length > 0;

  return (
    <div className="relative flex flex-col gap-s2">
      <textarea
        ref={champ}
        id={id}
        rows={3}
        value={valeur}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setCurseur(e.target.selectionStart);
        }}
        onClick={(e) => setCurseur(e.currentTarget.selectionStart)}
        onKeyUp={(e) => setCurseur(e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          if (!ouverte) return;

          /*
           * Les flèches et Entrée sont capturées SEULEMENT quand la liste est ouverte. Sinon
           * on empêcherait de déplacer le curseur dans son propre texte, ou de passer à la
           * ligne — dans un champ de commentaire, ce serait insupportable.
           */
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setChoisi((c) => (c + 1) % propositions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setChoisi((c) => (c - 1 + propositions.length) % propositions.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            const jeu = propositions[choisi];
            if (jeu !== undefined) {
              e.preventDefault();
              inserer(jeu);
            }
          } else if (e.key === "Escape") {
            e.preventDefault();
            // Fermer sans rien insérer : on déplace le curseur d'un cran fictif en réévaluant
            // la requête sur un texte inchangé — le plus simple est de vider la sélection.
            setCurseur(-1);
          }
        }}
        placeholder="Tu en penses quoi ? Tape @ pour mentionner un jeu."
        maxLength={2000}
        className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px] leading-relaxed"
      />

      {ouverte ? (
        <ul
          role="listbox"
          aria-label="Jeux à mentionner"
          className="absolute left-0 right-0 top-full z-20 mt-[2px] overflow-hidden rounded-[8px] border border-accent bg-surface"
        >
          {propositions.map((jeu, rang) => (
            <li key={jeu.id}>
              <button
                type="button"
                role="option"
                aria-selected={rang === choisi}
                /*
                 * `onMouseDown` et non `onClick` : le clic ferait d'abord perdre le focus au
                 * champ, ce qui referme la liste avant que la sélection n'arrive.
                 */
                onMouseDown={(e) => {
                  e.preventDefault();
                  inserer(jeu);
                }}
                className={`block w-full px-s4 py-s3 text-left text-[13px] ${
                  rang === choisi
                    ? "bg-accent/15 font-semibold text-accent-text"
                    : "text-text"
                }`}
              >
                {jeu.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
