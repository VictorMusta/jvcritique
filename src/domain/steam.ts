/**
 * Ce qu'on peut déduire d'un lien Steam — FR-12, dans sa forme la plus modeste.
 *
 * L'enrichissement automatique était reporté après la V0. Il le reste : on n'interroge aucune
 * API, on ne stocke rien de plus. On se contente de la seule information qu'une URL de fiche
 * Steam contient de façon fiable — son identifiant d'application — et de l'adresse publique
 * que Valve en dérive pour son image d'en-tête.
 *
 * POURQUOI POINTER PLUTÔT QUE RECOPIER. Victor a demandé des couvertures pour les jeux qui
 * n'en ont pas. Télécharger les jaquettes pour les réhéberger serait une redistribution
 * d'œuvres protégées ; pointer l'adresse que l'éditeur publie POUR ÊTRE EMBARQUÉE, c'est ce
 * que fait n'importe quelle page qui affiche une fiche Steam. Le navigateur va chercher
 * l'image chez Valve, comme il le ferait sur le magasin lui-même.
 *
 * La contrepartie, et elle est réelle : le navigateur du visiteur contacte un serveur tiers,
 * qui apprend donc son adresse IP. À l'échelle de cinq amis qui ont tous Steam ouvert par
 * ailleurs, l'échange est raisonnable — mais c'est un choix, pas un détail.
 */

/**
 * L'identifiant d'application contenu dans une URL de fiche Steam.
 *
 * Toutes les formes que Steam produit passent par `/app/<nombre>` : avec ou sans nom de jeu
 * à la suite, avec ou sans paramètres, sur `store.steampowered.com` comme sur `steamcommunity`.
 * On cherche donc ce motif plutôt que de décomposer l'URL morceau par morceau.
 *
 * Le nom d'hôte est vérifié : sans ça, n'importe quelle adresse contenant `/app/123` ferait
 * fabriquer une URL d'image sur un domaine qui n'est pas Steam, à partir d'un champ que
 * n'importe qui remplit.
 */
export function appIdSteam(steamUrl: string | null): string | null {
  if (steamUrl === null) {
    return null;
  }

  let hote: string;

  try {
    hote = new URL(steamUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (hote !== "steamcommunity.com" && !hote.endsWith("steampowered.com")) {
    return null;
  }

  const trouve = /\/app\/(\d+)(?:[/?#]|$)/.exec(steamUrl);

  return trouve?.[1] ?? null;
}

/**
 * L'image d'en-tête publiée par Steam, ou `null` si le lien n'en désigne aucune.
 *
 * `header.jpg` et pas `library_hero.jpg` : la première est la vignette que tout le monde
 * reconnaît, dans un format proche de celui de la galerie. La seconde est trois fois plus
 * large que haute — recadrée au format d'une capture, elle perdrait l'essentiel de l'image.
 */
export function couvertureSteam(steamUrl: string | null): string | null {
  const appId = appIdSteam(steamUrl);

  return appId === null
    ? null
    : `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}
