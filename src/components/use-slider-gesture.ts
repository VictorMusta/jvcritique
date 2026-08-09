"use client";

import { useRef } from "react";

/**
 * Empêche un curseur de note de bouger quand on veut seulement faire défiler la page.
 *
 * LE PROBLÈME, et il n'est pas celui qu'on croit. Sur Android, poser le doigt sur un
 * `<input type="range">` déplace le curseur à cette position IMMÉDIATEMENT, avant tout
 * geste. Un `touch-action: pan-y` autorise bien le défilement — vérifié en production — mais
 * la valeur a déjà changé au moment du contact. La feuille de style ne pouvait donc pas
 * suffire : elle arbitre le geste, pas le poser du doigt.
 *
 * LA RÈGLE retenue : tant qu'on ne sait pas si le geste est horizontal ou vertical, on
 * n'applique rien. La direction se décide au premier mouvement dépassant quelques pixels.
 *
 * - geste horizontal → la note suit le doigt, comme avant
 * - geste vertical   → la page défile, la note ne bouge pas
 * - appui franc sans mouvement → la note est appliquée au relâchement, ce qui préserve le
 *   geste « je touche directement la valeur que je veux »
 *
 * Le composant étant contrôlé, un changement refusé ne se voit pas : React remet aussitôt
 * la valeur d'origine dans le champ. Pas de sursaut, pas de retour visuel parasite.
 *
 * UN SEUL exemplaire du crochet suffit pour tous les curseurs d'un formulaire — il n'y a
 * qu'un doigt à la fois. C'est aussi ce qui permet de l'utiliser avec sept curseurs sans
 * violer les règles des crochets, qui interdisent d'en appeler un dans une boucle.
 */

/** Déplacement, en pixels, au-delà duquel on tranche la direction du geste. */
export const SEUIL = 6;

export type Direction = "horizontale" | "verticale";

/**
 * Tranche la direction d'un geste, ou `null` s'il est trop tôt pour le dire.
 *
 * Extraite du crochet parce que c'est la seule partie qui puisse être fausse en silence :
 * une comparaison d'axes inversée, ou un seuil appliqué à un seul des deux, produirait un
 * comportement subtilement cassé qu'aucun typage ne signalerait.
 *
 * L'égalité stricte va au vertical : sur un geste parfaitement diagonal, mieux vaut laisser
 * défiler la page que déplacer une note par surprise. Ne rien faire est toujours moins grave
 * que faire la mauvaise chose.
 */
export function decideDirection(
  dx: number,
  dy: number,
  seuil = SEUIL,
): Direction | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  // Un tremblement de quelques pixels ne dit rien de l'intention.
  if (ax < seuil && ay < seuil) {
    return null;
  }

  return ax > ay ? "horizontale" : "verticale";
}

export function useSliderGesture() {
  const depart = useRef<{ x: number; y: number } | null>(null);
  const direction = useRef<Direction | null>(null);
  const enAttente = useRef<(() => void) | null>(null);

  const reinitialiser = () => {
    depart.current = null;
    direction.current = null;
    enAttente.current = null;
  };

  return {
    /** À étaler sur chaque `<input type="range">`. */
    touchHandlers: {
      onTouchStart: (event: React.TouchEvent) => {
        const doigt = event.touches[0];
        depart.current = doigt ? { x: doigt.clientX, y: doigt.clientY } : null;
        direction.current = null;
        enAttente.current = null;
      },

      onTouchMove: (event: React.TouchEvent) => {
        if (direction.current !== null || depart.current === null) {
          return;
        }

        const doigt = event.touches[0];

        if (!doigt) {
          return;
        }

        const decision = decideDirection(
          doigt.clientX - depart.current.x,
          doigt.clientY - depart.current.y,
        );

        if (decision === null) {
          return;
        }

        direction.current = decision;

        // Le geste s'est révélé horizontal : on rattrape le changement mis de côté au
        // contact, sinon la note accuserait un retard de quelques pixels sur le doigt.
        if (direction.current === "horizontale" && enAttente.current) {
          enAttente.current();
          enAttente.current = null;
        }
      },

      onTouchEnd: () => {
        // Appui franc, sans mouvement : l'intention était bien de poser la note ici.
        if (direction.current === null && enAttente.current) {
          enAttente.current();
        }

        reinitialiser();
      },

      onTouchCancel: reinitialiser,
    },

    /**
     * À appeler depuis `onChange` à la place d'appliquer directement la valeur.
     *
     * `appliquer` est passé à chaque appel plutôt que capturé par le crochet : un même
     * exemplaire sert ainsi les sept curseurs, chacun avec sa propre action.
     */
    handleChange(appliquer: () => void) {
      // Souris, clavier, ou stylet : aucun geste tactile en cours, rien à arbitrer.
      if (depart.current === null) {
        appliquer();
        return;
      }

      if (direction.current === "horizontale") {
        appliquer();
        return;
      }

      if (direction.current === "verticale") {
        // Défilement : on ignore, définitivement.
        return;
      }

      // Direction encore indécise : on garde le changement sous le coude. Il sera appliqué
      // si le geste se révèle horizontal, ou s'il s'agissait d'un appui franc.
      enAttente.current = appliquer;
    },
  };
}
