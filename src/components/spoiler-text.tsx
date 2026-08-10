"use client";

import { createContext, useContext, useId, useMemo, useState } from "react";

import Link from "next/link";

import { parseMentions } from "~/domain/mentions";
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
          className="self-start rounded-[8px] border border-accent px-s4 py-s2 text-[11px] font-semibold text-accent-text"
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
  mentions,
}: {
  readonly text: string;
  readonly gameTitle: string;
  readonly mentions: TitresMentionnes;
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
      /*
       * Les mentions valent AUSSI dans un passage révélé : le texte est le même, seul le
       * moment où il devient visible change. Les traiter ici et pas là aurait fait qu'un jeu
       * mentionné dans un spoiler ne serait jamais cliquable.
       */
      <span className="rounded-[3px] bg-surface-raised px-[3px]">
        <AvecMentions texte={text} mentions={mentions} />
      </span>
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
          className="rounded-[3px] border border-accent px-s2 text-[11px] font-semibold text-accent-text"
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
      className="spoiler-mask cursor-pointer align-middle"
      /*
       * UNE BARRE DESSINÉE, pas des caractères.
       *
       * La version précédente répétait le pavé plein `█`, absent du sous-ensemble latin
       * d'Inter : il ne se dessinait pas, et le masque apparaissait comme un grand
       * rectangle vide. Défaut invisible à mes vérifications, qui portaient sur les octets
       * servis — il fallait regarder l'écran.
       *
       * Une largeur en `ch` proportionnelle au passage donne la même indication d'ampleur
       * que Discord, sans dépendre d'aucune police ni contenir le moindre caractère.
       */
      style={{
        display: "inline-block",
        width: `${Math.min(Math.max(text.length, 3), 24)}ch`,
        height: "1em",
      }}
    />
  );
}

/**
 * Rend une suite de segments produits par `renderForAudience`.
 *
 * N'accepte QUE des segments déjà passés par la fonction d'audience : elle ne reçoit jamais
 * une chaîne brute d'avis, ce qui rend impossible de l'appeler en contournant le filtrage
 * (frontière 4).
 */
/**
 * Titres des jeux mentionnés, par identifiant.
 *
 * Résolus par le serveur au moment du rendu, jamais stockés dans le texte : un titre corrigé
 * par un administrateur doit se répercuter partout, y compris dans un commentaire écrit il y
 * a trois mois.
 */
export type TitresMentionnes = Readonly<Record<string, string>>;

/**
 * Rend le texte d'un segment en transformant les mentions en liens.
 *
 * LES MENTIONS SONT TRAITÉES APRÈS LES SPOILERS, jamais avant, et l'ordre est une propriété
 * de sécurité : le texte reçu ici a déjà traversé la fonction d'audience. Une mention à
 * l'intérieur d'un passage masqué reste donc masquée — elle ne devient un lien qu'au moment
 * où le passage est révélé.
 *
 * Un identifiant inconnu — jeu supprimé — s'affiche comme du texte brut plutôt que comme un
 * lien mort. Le commentaire perd un lien, il ne gagne pas une erreur.
 */
function AvecMentions({
  texte,
  mentions,
}: {
  readonly texte: string;
  readonly mentions: TitresMentionnes;
}) {
  const parties = parseMentions(texte);

  if (parties.length === 1 && parties[0]?.kind === "texte") {
    return <>{parties[0].text}</>;
  }

  return (
    <>
      {parties.map((partie, index) => {
        if (partie.kind === "texte") {
          return <span key={index}>{partie.text}</span>;
        }

        const titre = mentions[partie.gameId];

        if (titre === undefined) {
          return <span key={index}>@?</span>;
        }

        return (
          <Link key={index} href={`/game/${partie.gameId}`} className="lien">
            @{titre}
          </Link>
        );
      })}
    </>
  );
}

export function SpoilerText({
  segments,
  gameTitle,
  mentions = {},
}: {
  readonly segments: readonly RenderedSegment[];
  readonly gameTitle: string;
  /** Titres des jeux mentionnés. Vide sur les surfaces qui n'en acceptent pas. */
  readonly mentions?: TitresMentionnes;
}) {
  return (
    <span className="whitespace-pre-line">
      {segments.map((segment, index) => {
        switch (segment.kind) {
          case "text":
            return (
              <span key={index}>
                <AvecMentions texte={segment.text} mentions={mentions} />
              </span>
            );

          case "revealed":
            // Audience auteur. Le passage s'affiche, discrètement souligné pour rappeler
            // qu'il est masqué pour les autres — sinon on oublie ce qu'on a caché.
            return (
              <span
                key={index}
                title="Masqué pour les autres"
                className="rounded-[3px] bg-surface-raised px-[3px] underline decoration-accent decoration-dotted underline-offset-2"
              >
                <AvecMentions texte={segment.text} mentions={mentions} />
              </span>
            );

          case "spoiler":
            return (
              <MaskedPassage
                key={index}
                text={segment.text}
                gameTitle={gameTitle}
                mentions={mentions}
              />
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
