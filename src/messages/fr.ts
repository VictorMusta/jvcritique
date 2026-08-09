/**
 * Libellés de l'interface — INV-8 : le français est la seule langue du produit, et les
 * libellés sont externalisés.
 *
 * Externalisés non pas pour préparer une traduction (il n'y en aura pas) mais parce que
 * `EXPERIENCE.md` impose une exigence de ton : le produit doit parler comme un pote, et
 * jamais comme une pile technique. « Network error » est explicitement interdit. Regrouper
 * les formulations dans un seul fichier est ce qui rend cette exigence vérifiable d'un
 * coup d'œil — dispersées dans les composants, personne ne les relit jamais ensemble.
 */

/**
 * Messages d'échec, indexés par code de domaine (D9).
 *
 * Aucun ne mentionne de concept technique. `UNEXPECTED` en particulier : l'utilisateur
 * apprend que ce n'est pas sa faute et ce qu'il peut faire, la trace part dans les
 * journaux serveur.
 */
export const errorMessages = {
  NOT_AUTHENTICATED: "Il faut être connecté pour faire ça.",
  NOT_AUTHORIZED: "Cette action ne t'est pas permise.",
  VALIDATION_FAILED: "Il y a un souci dans ce qui a été saisi.",
  NOT_FOUND: "Impossible de trouver ça. C'est peut-être supprimé.",
  /**
   * Deux codes plutôt qu'un `ALREADY_EXISTS` fourre-tout : « tu as déjà un avis sur ce jeu »
   * et « ce titre est déjà pris » se corrigent différemment, et un message générique
   * obligerait l'utilisateur à deviner lequel des deux le concerne.
   */
  ALREADY_REVIEWED:
    "Tu as déjà écrit sur ce jeu. Modifie ton avis plutôt que d'en écrire un second.",
  GAME_TITLE_TAKEN: "Un autre jeu porte déjà ce titre.",
  UNEXPECTED: "Ça a cassé de notre côté. Réessaie dans un instant.",
} as const;

export type ErrorCode = keyof typeof errorMessages;

/** Libellés de la notation. Les sept Domaines dans l'ordre du glossaire. */
export const domainLabels = {
  gameplay: "Gameplay",
  story: "Histoire",
  atmosphere: "Ambiance",
  artDirection: "Direction artistique et graphismes",
  soundtrack: "Bande-son",
  pacing: "Durée de vie et rythme",
  technical: "Technique",
} as const;

/**
 * Mentions qui énoncent une RÈGLE DE CALCUL.
 *
 * `DESIGN.md` les distingue des mentions de confort : elles s'affichent en pleine couleur
 * et jamais atténuées, parce qu'elles portent une information dont l'absence rendrait le
 * comportement du produit incompréhensible. Un champ vide n'a pas le même effet qu'un zéro,
 * et l'utilisateur ne peut pas le deviner.
 */
export const bearingHints = {
  emptyDomain:
    "Facultatif. Sans note, ce domaine sera considéré comme ne s'appliquant pas à ce jeu et exclu du calcul.",
  notApplicableExists:
    "Une case « pas évaluable » existe si ce domaine n'a pas de sens pour ce jeu. Zéro reste une note légitime.",
  weightingZero:
    "Un domaine à zéro est exclu de ton calcul, mais reste visible à la lecture.",
  spoilerSyntax:
    "Entoure un passage de || pour le masquer : ||comme ça||. Personne ne le verra sans cliquer, et un visiteur sans compte ne le recevra même pas.",
} as const;

/**
 * Réactions à un avis.
 *
 * Trois seulement, et c'est délibéré : une liste plus longue transformerait un geste en
 * choix, et un choix en hésitation. « Ça me tente » est la première parce que c'est celle
 * qui mesure la raison d'être du produit.
 */
export const reactionLabels = {
  tempting: "Ça me tente",
  sameHere: "Moi aussi",
  disagree: "Pas d'accord",
} as const;

/** Mentions de simple confort — atténuées, elles ne changent aucun calcul. */
export const comfortHints = {
  optional: "Facultatif.",
  playtimeFree: "En heures, comme tu veux.",
} as const;

/**
 * Étiquettes du mode d'obtention d'une note.
 *
 * INV-5 : une note ne s'affiche jamais sans le nom de son propriétaire ni son échantillon.
 * Ces formulations sont le véhicule de cette garantie — et `simpleMean` dit explicitement
 * que la note n'est PAS personnalisée, pour qu'un repli ne se fasse jamais passer pour un
 * calcul sur mesure.
 */
export const scoreModeLabels = {
  weighted: (count: number) =>
    `Selon tes critères, sur ${count} ${count > 1 ? "domaines notés" : "domaine noté"}.`,
  simpleMean: (count: number) =>
    `Moyenne simple sur ${count} ${count > 1 ? "domaines" : "domaine"} — tes critères ne sont pas couverts par cet avis.`,
  none: () => "Pas de domaine noté, donc pas de note recalculable.",
} as const;
