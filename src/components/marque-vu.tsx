"use client";

import { useEffect } from "react";

import { marquerVuAction } from "~/server/actions/paquet";

/**
 * Pose la marque « vu » à l'ouverture d'un avis.
 *
 * Un composant qui ne rend rien, dont le seul travail est un effet au montage. C'est la
 * raison d'être de sa forme : un effet client ne se déclenche que quand la page est
 * réellement affichée, là où une écriture pendant le rendu serveur se déclencherait aussi au
 * préchargement des liens — et marquerait « vus » des avis que personne n'a ouverts.
 */
export function MarqueVu({ reviewId }: { readonly reviewId: string }) {
  useEffect(() => {
    // Rien à afficher en cas d'échec : la marque est un confort, pas une fonction. Au pire
    // l'avis réapparaîtra dans le paquet, et un geste le marquera.
    void marquerVuAction(reviewId);
  }, [reviewId]);

  return null;
}
