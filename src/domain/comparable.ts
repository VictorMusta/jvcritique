/**
 * Rend une chaîne comparable : sans accents, sans casse.
 *
 * Extraite du composant de recherche de jeux le 10 août 2026, quand l'autocomplétion des
 * mentions en a eu besoin. Deux copies auraient fini par diverger — et la divergence se
 * verrait comme « la recherche trouve ce jeu mais la mention ne le propose pas », ce que
 * personne ne relierait à un défaut de normalisation.
 *
 * Sans elle, chercher « pokemon » ne trouve pas « Pokémon », et « elex » rate « ÉLEX ». C'est
 * le défaut le plus courant d'une recherche en français, et il fait conclure que le jeu n'est
 * pas au catalogue — donc republier un doublon.
 */
export function comparable(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
