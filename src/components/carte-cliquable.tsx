"use client";

import { useRouter } from "next/navigation";

/**
 * Rend toute la carte d'un avis cliquable — demandé par Victor le 10 août 2026 : « je trouve
 * le bouton "lire l'avis" un peu trop petit et peu visible, j'aimerais pouvoir cliquer
 * n'importe où sur l'avis ».
 *
 * UN GESTIONNAIRE DE CLIC, PAS UN LIEN QUI RECOUVRE LA CARTE. Le motif habituel — un `<a>`
 * en position absolue sur toute la surface — empêche de SÉLECTIONNER LE TEXTE : on ne peut
 * plus copier une phrase d'un avis, ni même surligner en lisant. Sur un site dont le contenu
 * est du texte écrit par des amis, c'est un prix qu'on ne paie pas.
 *
 * TROIS CAS OÙ LE CLIC NE DOIT PAS NAVIGUER, et chacun s'est présenté à l'essai.
 *
 * 1. Un lien ou un bouton à l'intérieur — le titre du jeu, le nom de l'auteur, « lire la
 *    suite », les réactions. Ils ont leur propre destination, et la carte ne doit pas la
 *    voler.
 * 2. Une sélection de texte en cours. Relâcher la souris après avoir surligné trois mots
 *    produit un `click` : sans ce contrôle, sélectionner une phrase changerait de page.
 * 3. Un clic du milieu ou avec une touche de modification. Le navigateur en fait un « ouvrir
 *    dans un nouvel onglet » sur un vrai lien ; ici on laisse simplement passer, plutôt que
 *    de simuler mal ce comportement.
 *
 * LE LIEN VISIBLE RESTE, et c'est lui le chemin accessible. Un `onClick` sur un conteneur
 * n'est pas atteignable au clavier ; le clic sur la carte est une commodité posée PAR-DESSUS
 * un lien réel, jamais à sa place.
 */
export function CarteCliquable({
  href,
  className,
  children,
}: {
  readonly href: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <article
      className={className}
      onClick={(evenement) => {
        if (evenement.defaultPrevented) return;

        // Clic du milieu, Ctrl, Cmd, Maj : on ne se substitue pas au navigateur.
        if (
          evenement.button !== 0 ||
          evenement.metaKey ||
          evenement.ctrlKey ||
          evenement.shiftKey ||
          evenement.altKey
        ) {
          return;
        }

        const cible = evenement.target;

        if (
          cible instanceof Element &&
          cible.closest("a, button, input, textarea, select, [role='button']")
        ) {
          return;
        }

        // Une sélection en cours signifie qu'on lisait, pas qu'on voulait partir.
        if ((window.getSelection()?.toString() ?? "") !== "") {
          return;
        }

        router.push(href);
      }}
    >
      {children}
    </article>
  );
}
