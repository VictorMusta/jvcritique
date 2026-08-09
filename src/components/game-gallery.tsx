"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

/**
 * Les captures de TOUS les avis d'un jeu, en carrousel — demandé par Victor le 9 août 2026.
 *
 * Remplace la couverture unique posée le matin même. Elle était calée à la largeur du
 * panneau par des marges négatives, ce qui ne tenait pas : ici la galerie est PLACÉE HORS
 * de la zone rembourrée, et la question de la largeur ne se pose plus. Un défilement qu'on
 * corrige par un calcul de marge est un défilement mal rangé.
 *
 * DÉFILEMENT NATIF, sans bibliothèque. `scroll-snap` fait le calage, le pouce fait le reste,
 * et la molette horizontale marche sans qu'on écrive une ligne. Un carrousel en JavaScript
 * coûterait une dépendance, casserait le défilement tactile du système, et perdrait les
 * images pour qui navigue au clavier.
 */

export type ImageGalerie = {
  readonly storageKey: string;
  readonly width: number;
  readonly height: number;
  /** L'avis d'où elle vient — une capture appartient toujours à quelqu'un. */
  readonly reviewId: string;
  readonly authorName: string;
};

export function GameGallery({
  images,
  gameTitle,
  couverture,
}: {
  readonly images: readonly ImageGalerie[];
  readonly gameTitle: string;
  /**
   * Image publiée par Steam, employée SEULEMENT quand personne n'a encore déposé de capture.
   *
   * Une vraie capture l'emporte toujours : elle vient de quelqu'un qui a joué, la jaquette
   * vient du service de vente. La première dit quelque chose, la seconde comble un vide.
   */
  readonly couverture?: string | null;
}) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const glisser = useCallback((sens: -1 | 1) => {
    const element = piste.current;
    if (!element) return;

    // La largeur d'une vue, pas une valeur en dur : la même ligne marche sur un téléphone
    // et sur un écran large, et elle survit à un changement de mise en page.
    element.scrollBy({ left: sens * element.clientWidth, behavior: "smooth" });
  }, []);

  const surDefilement = useCallback(() => {
    const element = piste.current;
    if (!element) return;

    setIndex(Math.round(element.scrollLeft / element.clientWidth));
  }, []);

  if (images.length === 0) {
    if (!couverture) {
      return null;
    }

    /*
     * Pas de carrousel pour une image seule : ni flèches, ni compteur, ni piste défilante.
     * Et AUCUN nom d'auteur — c'est le point qui a écarté la première idée, qui était de
     * déposer ces couvertures dans les avis existants. La galerie affiche « par Untel » sur
     * chaque capture : une jaquette y aurait été attribuée à quelqu'un qui ne l'a pas prise.
     */
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={couverture}
        alt=""
        loading="eager"
        decoding="async"
        className="aspect-video w-full bg-surface-raised object-cover"
      />
    );
  }

  return (
    <div className="relative">
      <div
        ref={piste}
        onScroll={surDefilement}
        /*
         * `tabIndex` sur une zone défilante : sans lui, quelqu'un qui navigue au clavier ne
         * peut pas atteindre les images suivantes. C'est le comportement que le navigateur
         * donne gratuitement à un conteneur focalisable, et qu'un carrousel en JavaScript
         * fait perdre.
         */
        tabIndex={0}
        role="region"
        aria-label={`Captures de ${gameTitle}`}
        className="flex snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((image, rang) => (
          /*
           * L'IMAGE N'EST PAS UN LIEN, et c'est délibéré.
           *
           * Première version : toute la diapositive menait à l'avis. Sur un écran tactile, un
           * balayage qui se termine un peu sec est interprété comme un clic — on voulait faire
           * défiler, on se retrouve sur une autre page. Le geste principal d'un carrousel doit
           * rester le glissement.
           *
           * Le lien vit donc sur le seul nom de l'auteur : une cible petite, qu'on ne touche
           * qu'en le voulant. Et il reste vrai que chaque capture appartient à quelqu'un.
           */
          <div
            key={image.storageKey}
            className="relative w-full shrink-0 snap-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/screenshot/${image.storageKey}?v=vignette`}
              /*
               * `alt` vide et volontaire : l'image est décorative, le titre du jeu est en
               * toutes lettres juste en dessous. Décrire « une capture de Firewatch » ferait
               * entendre deux fois la même chose à qui écoute la page.
               */
              alt=""
              width={image.width}
              height={image.height}
              /*
               * La PREMIÈRE est chargée tout de suite, les autres à l'approche.
               *
               * Elle est visible dès l'ouverture : la mettre en `lazy` retarderait le seul
               * élément que l'œil attend, ce qui est exactement le contre-emploi. Les
               * suivantes sont hors champ, et un jeu à quinze avis n'a aucune raison de
               * télécharger quinze images que personne ne fera peut-être défiler.
               */
              loading={rang === 0 ? "eager" : "lazy"}
              decoding="async"
              className="aspect-video w-full bg-surface-raised object-cover"
            />
            {/* Le nom de l'auteur sur l'image : une capture appartient à quelqu'un, et le
                fil du produit ne montre jamais un contenu sans dire de qui il vient. */}
            <Link
              href={`/review/${image.reviewId}`}
              className="absolute bottom-s2 left-s3 rounded-[6px] border border-border bg-bg/85 px-s3 py-[2px] text-[11px] text-text hover:border-accent"
            >
              {image.authorName}
            </Link>
          </div>
        ))}
      </div>

      {images.length > 1 ? (
        <>
          <Fleche sens={-1} onClick={() => glisser(-1)} cache={index === 0} />
          <Fleche
            sens={1}
            onClick={() => glisser(1)}
            cache={index >= images.length - 1}
          />

          {/* Compteur plutôt que des pastilles : au-delà de cinq ou six captures, une rangée
              de points ne se compte plus et ne se clique pas au pouce. */}
          <span className="tnum absolute right-s3 top-s3 rounded-[6px] bg-bg/75 px-s3 py-[2px] text-[11px] text-text">
            {index + 1} / {images.length}
          </span>
        </>
      ) : null}
    </div>
  );
}

function Fleche({
  sens,
  onClick,
  cache,
}: {
  readonly sens: -1 | 1;
  readonly onClick: () => void;
  readonly cache: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={sens === -1 ? "Capture précédente" : "Capture suivante"}
      /*
       * Masquée en bout de course, mais RETIRÉE de la navigation clavier au lieu d'être
       * seulement transparente : un bouton invisible qui reçoit le focus est un piège.
       */
      tabIndex={cache ? -1 : 0}
      aria-hidden={cache}
      className={`absolute top-1/2 flex h-[34px] w-[34px] -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg/80 text-text transition-opacity ${
        sens === -1 ? "left-s3" : "right-s3"
      } ${cache ? "pointer-events-none opacity-0" : "opacity-90"}`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={sens === -1 ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
