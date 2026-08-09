"use client";

import { useEffect, useRef, useState } from "react";

import type { RenderedSegment } from "~/domain/spoilers/render-for-audience";
import { SpoilerText } from "./spoiler-text";

/**
 * Le corps d'un avis dans le fil — un champ, puis tous les autres au clic.
 *
 * Demandé par Victor le 10 août 2026 : « je veux le lire la suite, et que ça affiche aussi
 * les 3 autres champs remplis s'ils le sont ».
 *
 * LE BOUTON N'APPARAÎT QUE S'IL Y A QUELQUE CHOSE À MONTRER, et c'est la seule chose qui
 * demande du soin ici. Un « lire la suite » sous un texte déjà entier est le défaut le plus
 * courant de ce motif : il fait cliquer pour rien, et on cesse d'y croire.
 *
 * Deux raisons de l'afficher, et il suffit de l'une : le premier champ DÉBORDE, ou d'autres
 * champs attendent en dessous. Un avis dont la recommandation tient en une ligne mais qui
 * détaille longuement ce qui a manqué doit pouvoir se déplier.
 *
 * LE DÉBORDEMENT EST MESURÉ, PAS DEVINÉ. Compter les caractères donnerait un résultat faux :
 * trois lignes de mots courts n'en contiennent pas autant que trois lignes de mots longs, et
 * la largeur change avec l'appareil. On compare la hauteur réelle à la hauteur visible.
 */

export type ChampAvis = {
  readonly label: string;
  readonly segments: readonly RenderedSegment[];
};

export function ReviewBody({
  champs,
  gameTitle,
}: {
  /** Les champs REMPLIS, dans l'ordre du formulaire. Le premier sert d'aperçu. */
  readonly champs: readonly ChampAvis[];
  readonly gameTitle: string;
}) {
  const premier = champs[0];
  const autres = champs.slice(1);

  const texte = useRef<HTMLParagraphElement>(null);
  const [deploye, setDeploye] = useState(false);
  const [deborde, setDeborde] = useState(false);

  useEffect(() => {
    const element = texte.current;
    if (element === null) return;

    /*
     * Mesuré au montage ET à chaque redimensionnement : une rotation de téléphone change la
     * largeur, donc le nombre de lignes. Sans le second cas, le bouton disparaîtrait en
     * paysage sur un texte qui tient désormais, ou l'inverse — et resterait faux jusqu'au
     * prochain chargement.
     */
    const mesurer = () => {
      setDeborde(element.scrollHeight > element.clientHeight + 1);
    };

    mesurer();

    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);

    return () => observateur.disconnect();
  }, [premier]);

  if (premier === undefined) {
    return null;
  }

  // Replier ne sert à rien si le texte tenait déjà : le bouton ne se propose que quand il a
  // quelque chose à faire dans les deux sens.
  const utile = deborde || autres.length > 0;

  return (
    <div className="flex flex-col gap-s3">
      <div className="flex flex-col gap-[2px]">
        <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
          {premier.label}
        </span>
        {/*
          Le texte passe par la fonction d'audience, comme partout ailleurs. C'est ici que
          l'oubli serait le plus grave : le fil affiche ce contenu sans que personne n'ait
          rien demandé, donc un spoiler non filtré serait vu de tous, immédiatement.
        */}
        <p
          ref={texte}
          className={`text-[13px] leading-relaxed ${deploye ? "" : "line-clamp-3"}`}
        >
          <SpoilerText segments={premier.segments} gameTitle={gameTitle} />
        </p>
      </div>

      {deploye
        ? autres.map((champ) => (
            <div key={champ.label} className="flex flex-col gap-[2px]">
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
                {champ.label}
              </span>
              <p className="text-[13px] leading-relaxed">
                <SpoilerText segments={champ.segments} gameTitle={gameTitle} />
              </p>
            </div>
          ))
        : null}

      {utile ? (
        <button
          type="button"
          onClick={() => setDeploye(!deploye)}
          aria-expanded={deploye}
          className="self-start text-[12px] font-semibold text-accent-text"
        >
          {deploye
            ? "Réduire"
            : autres.length > 0
              ? /*
                 * Le libellé ANNONCE CE QU'IL Y A DESSOUS. « Lire la suite » sur un avis qui
                 * cache trois sections ferait croire à quelques lignes de plus, et personne
                 * ne saurait que l'auteur a aussi écrit ce qu'il a détesté.
                 */
                `Lire la suite · ${autres.length} ${autres.length === 1 ? "autre section" : "autres sections"}`
              : "Lire la suite"}
        </button>
      ) : null}
    </div>
  );
}
