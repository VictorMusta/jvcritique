/**
 * Mentions de jeux dans un commentaire — demandées par Victor le 10 août 2026 : « pouvoir
 * mentionner un jeu en faisant @nomdujeu, ce qui changerait le mot en lien cliquable ».
 *
 * CE QUI EST STOCKÉ EST L'IDENTIFIANT, PAS LE TITRE, et c'est la décision qui porte tout le
 * reste. Écrire `@Elden Ring` dans le texte poserait deux problèmes qu'aucune astuce ne
 * résout : un titre contient des espaces, donc rien ne dit où la mention s'arrête ; et un
 * administrateur peut corriger un titre — « super marley simulator » l'a été — ce qui
 * laisserait des mentions pointant vers un nom qui n'existe plus.
 *
 * Le texte enregistré contient donc `@[identifiant]`, et le titre est relu à l'affichage. Une
 * mention est ainsi toujours juste, même des mois après un renommage.
 *
 * L'AUTEUR NE TAPE JAMAIS CETTE FORME : l'autocomplétion l'insère. C'est aussi ce qui garantit
 * la règle de Victor — « si le jeu n'a pas d'avis posé, on peut pas » — puisque la liste
 * proposée ne contient que des jeux du catalogue, et que le catalogue naît des avis.
 */

/**
 * La forme exacte d'un identifiant. Rien d'autre n'est reconnu comme une mention.
 *
 * Quelqu'un qui écrit littéralement `@[coucou]` voit son texte tel quel : c'est un
 * caractère parmi d'autres, pas une syntaxe qu'il faut échapper. Une grammaire qui capture
 * plus que ce qu'elle sait résoudre produit des liens morts.
 */
const MENTION =
  /@\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;

export type PartieTexte =
  | { readonly kind: "texte"; readonly text: string }
  | { readonly kind: "mention"; readonly gameId: string };

/**
 * Découpe un texte en parties, en isolant les mentions.
 *
 * Rend TOUJOURS au moins une partie pour un texte non vide, et ne perd aucun caractère : ce
 * qui entre ressort, mention comprise. C'est ce que les tests vérifient en priorité — un
 * découpage qui mange un mot est pire qu'une mention qui ne se transforme pas.
 */
export function parseMentions(texte: string): PartieTexte[] {
  const parties: PartieTexte[] = [];
  let curseur = 0;

  // `matchAll` plutôt qu'une boucle sur `exec` : le drapeau global rend `exec` dépendant de
  // l'état interne de l'expression, qui est partagé entre les appels d'un module.
  for (const trouve of texte.matchAll(MENTION)) {
    const debut = trouve.index;
    const gameId = trouve[1];

    if (debut === undefined || gameId === undefined) {
      continue;
    }

    if (debut > curseur) {
      parties.push({ kind: "texte", text: texte.slice(curseur, debut) });
    }

    // Normalisé en minuscules : la casse d'un identifiant hexadécimal n'a aucun sens, et deux
    // écritures de la même mention doivent donner la même clé de recherche.
    parties.push({ kind: "mention", gameId: gameId.toLowerCase() });
    curseur = debut + trouve[0].length;
  }

  if (curseur < texte.length) {
    parties.push({ kind: "texte", text: texte.slice(curseur) });
  }

  return parties;
}

/**
 * Les identifiants mentionnés dans un ou plusieurs textes, sans doublon.
 *
 * Sert au serveur à charger tous les titres EN UNE REQUÊTE avant de rendre une page. Un fil
 * de commentaires qui interrogerait la base par mention donnerait autant de requêtes que de
 * mentions — la contrainte qui avait déjà imposé le chargement groupé des pondérations.
 */
export function extraireMentions(textes: readonly (string | null)[]): string[] {
  const trouvees = new Set<string>();

  for (const texte of textes) {
    if (texte === null) continue;

    for (const partie of parseMentions(texte)) {
      if (partie.kind === "mention") {
        trouvees.add(partie.gameId);
      }
    }
  }

  return [...trouvees];
}

/** Compose la forme stockée. Le seul endroit qui connaisse la syntaxe. */
export function ecrireMention(gameId: string): string {
  return `@[${gameId}]`;
}
