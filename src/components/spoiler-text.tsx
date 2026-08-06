"use client";

import { createContext, useContext, useId, useMemo, useState } from "react";

import type { RenderedSegment } from "~/domain/spoilers/render-for-audience";

/**
 * Affichage d'un texte d'avis contenant des passages masqués — FR-6.
 *
 * LA GARANTIE : le texte d'un spoiler n'est JAMAIS un nœud de texte peint avant d'être
 * révélé. Il n'est pas rendu puis caché par du CSS — il n'est pas rendu du tout. C'est
 * l'exigence explicite de Victor : « en s'assurant que le front n'affiche jamais le texte
 * sous spoiler à aucun moment, pour éviter que ça s'affiche puis se cache ».
 *
 * Un masquage par CSS (`color: transparent`, `filter: blur`) laisse le texte dans la mise en
 * page : si la feuille de style arrive en retard, échoue, ou est désactivée, le passage
 * apparaît. Ici il n'y a rien à cacher, donc rien à rater.
 *
 * ÉCART ASSUMÉ par rapport à R-D6, qui demandait le texte « dans un attribut, pas un nœud de
 * texte » : il voyage dans les propriétés du composant, donc dans la charge utile RSC, et non
 * dans un attribut `data-`. La propriété visée est identique — jamais de nœud de texte peint
 * — et la formulation d'origine supposait un rendu sans JavaScript. Ajouter en plus un
 * attribut `data-` ne renforcerait rien et exposerait le texte une seconde fois dans le DOM.
 */

type SpoilerScopeValue = {
  readonly allRevealed: boolean;
  readonly revealAll: () => void;
};

const SpoilerScopeContext = createContext<SpoilerScopeValue | null>(null);

/**
 * Portée de révélation, à poser autour de TOUS les champs d'un même avis.
 *
 * FR-6 : « une commande révéler découvre tous les passages masqués de l'avis, pas seulement
 * celui cliqué ». Cela impose un état partagé entre des champs qui sont des sections
 * distinctes de la page — d'où le contexte plutôt qu'un état local par passage.
 *
 * `hasSpoilers` est passé par le parent, qui l'a déjà calculé côté serveur. Une première
 * version laissait chaque passage s'enregistrer lui-même pendant le rendu : c'était un effet
 * de bord en phase de rendu, avec un `setState` qui aurait bouclé. L'information existait
 * déjà en amont — il suffisait de la descendre.
 */
export function SpoilerScope({
  hasSpoilers,
  children,
}: {
  readonly hasSpoilers: boolean;
  readonly children: React.ReactNode;
}) {
  const [allRevealed, setAllRevealed] = useState(false);

  const value = useMemo<SpoilerScopeValue>(
    () => ({
      allRevealed,
      revealAll: () => setAllRevealed(true),
    }),
    [allRevealed],
  );

  return (
    <SpoilerScopeContext.Provider value={value}>
      {hasSpoilers && !allRevealed ? (
        <button
          type="button"
          onClick={() => setAllRevealed(true)}
          className="self-start rounded-[8px] border border-accent px-s4 py-s2 text-[11px] font-semibold text-accent"
        >
          Tout révéler
        </button>
      ) : null}
      {children}
    </SpoilerScopeContext.Provider>
  );
}

function MaskedPassage({
  text,
  gameTitle,
}: {
  readonly text: string;
  readonly gameTitle: string;
}) {
  const scope = useContext(SpoilerScopeContext);
  const [locallyRevealed, setLocallyRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const warningId = useId();

  const revealed = locallyRevealed || (scope?.allRevealed ?? false);

  if (revealed) {
    // Après révélation, le contenu réel entre dans l'arbre d'accessibilité et devient
    // sélectionnable comme n'importe quel texte.
    return (
      <span className="rounded-[3px] bg-surface-raised px-[3px]">{text}</span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-s2 align-baseline">
        <span id={warningId} className="text-[11px] italic text-text-muted">
          Ça révèle un spoiler sur {gameTitle}.
        </span>
        <button
          type="button"
          onClick={() => setLocallyRevealed(true)}
          aria-describedby={warningId}
          className="rounded-[3px] border border-accent px-s2 text-[11px] font-semibold text-accent"
        >
          Révéler
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-[3px] border border-border px-s2 text-[11px] text-text-muted"
        >
          Non
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      /*
       * L'étiquette porte toute l'information, parce que le contenu visible n'en porte
       * aucune : les pavés sont décoratifs et sortent de l'arbre d'accessibilité. Sans cette
       * étiquette, un lecteur d'écran annoncerait un bouton vide.
       */
      aria-label={`Passage masqué — spoiler sur ${gameTitle}. Activer pour révéler.`}
      className="spoiler-mask cursor-pointer align-baseline px-[3px]"
    >
      {/*
        Des pavés, pas le texte. Leur nombre suit la longueur du passage — comme Discord,
        qui laisse deviner l'ampleur sans rien divulguer.
      */}
      <span aria-hidden>{"█".repeat(Math.min(text.length, 40))}</span>
    </button>
  );
}

/**
 * Rend une suite de segments produits par `renderForAudience`.
 *
 * N'accepte QUE des segments déjà passés par la fonction d'audience : elle ne reçoit jamais
 * une chaîne brute d'avis, ce qui rend impossible de l'appeler en contournant le filtrage
 * (frontière 4).
 */
export function SpoilerText({
  segments,
  gameTitle,
}: {
  readonly segments: readonly RenderedSegment[];
  readonly gameTitle: string;
}) {
  return (
    <span className="whitespace-pre-line">
      {segments.map((segment, index) => {
        switch (segment.kind) {
          case "text":
            return <span key={index}>{segment.text}</span>;

          case "revealed":
            // Audience auteur. Le passage s'affiche, discrètement souligné pour rappeler
            // qu'il est masqué pour les autres — sinon on oublie ce qu'on a caché.
            return (
              <span
                key={index}
                title="Masqué pour les autres"
                className="rounded-[3px] bg-surface-raised px-[3px] underline decoration-accent decoration-dotted underline-offset-2"
              >
                {segment.text}
              </span>
            );

          case "spoiler":
            return (
              <MaskedPassage key={index} text={segment.text} gameTitle={gameTitle} />
            );

          case "redacted":
            /*
             * Audience « extrait ». Ce cas ne devrait pas atteindre ce composant : un extrait
             * est une chaîne de caractères pour une balise Open Graph, pas une page. Rendu
             * quand même, sans texte, pour que le type reste exhaustif — si ce marqueur
             * apparaît un jour à l'écran, c'est qu'une surface appelle la mauvaise audience.
             */
            return (
              <span key={index} className="text-[12px] italic text-text-muted">
                [passage masqué]
              </span>
            );
        }
      })}
    </span>
  );
}
