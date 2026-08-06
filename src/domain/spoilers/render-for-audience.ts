import { parseSpoilers } from "./parse-spoilers";

/**
 * LE SEUL chemin d'un texte d'avis vers quelque chose d'affichable — frontière 4.
 *
 * Toute autre voie est un défaut de sécurité, pas un raccourci. Un composant qui recevrait
 * une chaîne brute d'avis et la rendrait directement contournerait tout ce fichier.
 */

/**
 * Qui lit. La distinction auteur / membre / anonyme n'est pas cosmétique : les trois reçoivent
 * des OCTETS DIFFÉRENTS.
 */
export type Audience =
  /** L'auteur de l'avis. Il connaît son propre texte : rien à lui cacher. */
  | "author"
  /** Un ami authentifié. Le contenu est présent mais ne doit JAMAIS être peint. */
  | "member"
  /** Visiteur sans compte, et générateur d'aperçu Open Graph. Contenu ABSENT des octets. */
  | "anonymous";

/**
 * Segment prêt à être rendu.
 *
 * Noter `redacted` : il ne porte **aucun champ texte**. C'est la mise en œuvre du
 * durcissement de R-D6, et j'ai choisi l'absence plutôt que la protection.
 *
 * L'exigence d'origine demandait un type enveloppé n'exposant ni `toString`, ni `toJSON`, ni
 * `valueOf`, pour qu'une sérialisation d'action serveur ne le déballe pas silencieusement.
 * Mais un objet qui *contient* le texte tout en interdisant sa lecture reste un objet qui
 * contient le texte : il suffit d'un `structuredClone`, d'un journal, d'un message d'erreur
 * ou d'un futur champ ajouté par distraction pour qu'il ressorte.
 *
 * Ici, pour une audience anonyme, **le texte n'a jamais été mis dans l'objet**. Il n'y a rien
 * à déballer, rien à protéger, et aucune discipline à maintenir. On ne peut pas fuiter ce
 * qu'on n'a pas.
 */
export type RenderedSegment =
  | { readonly kind: "text"; readonly text: string }
  /** Auteur : le passage s'affiche, discrètement marqué comme masqué pour les autres. */
  | { readonly kind: "revealed"; readonly text: string }
  /** Membre : présent dans les octets, à porter par un ATTRIBUT et jamais par un nœud de texte. */
  | { readonly kind: "spoiler"; readonly text: string }
  /** Anonyme : le contenu n'existe pas. Pas de champ `text`, volontairement. */
  | { readonly kind: "redacted" };

/**
 * Détermine l'audience d'un lecteur face à un avis donné.
 *
 * Fonction pure et minuscule, mais elle mérite d'exister séparément : c'est le seul endroit
 * où se décide qui reçoit quoi. Recalculée à la main dans chaque page, la règle finirait par
 * différer d'une surface à l'autre — et l'écart serait exactement le trou.
 */
export function audienceFor(
  readerId: string | null,
  authorId: string,
): Audience {
  if (readerId === null) {
    return "anonymous";
  }

  return readerId === authorId ? "author" : "member";
}

/**
 * Découpe un texte d'avis selon son audience.
 *
 * ORDRE IMPOSÉ : parser d'abord, retirer ensuite. Ne jamais tronquer avant — D10 rend un
 * `||` non fermé littéral, donc tronquer un extrait avant de parser coupe la fermeture et
 * fait apparaître le spoiler en clair. Voir `excerptForAnonymous` pour l'ordre correct.
 */
export function renderForAudience(
  body: string,
  audience: Audience,
): RenderedSegment[] {
  return parseSpoilers(body).map((segment): RenderedSegment => {
    if (segment.kind === "text") {
      return segment;
    }

    switch (audience) {
      case "author":
        return { kind: "revealed", text: segment.text };
      case "member":
        return { kind: "spoiler", text: segment.text };
      case "anonymous":
        // Aucun texte transmis. C'est INV-6 : le texte d'un spoiler n'est jamais présent
        // dans les octets servis à une audience non authentifiée.
        return { kind: "redacted" };
    }
  });
}

/**
 * Extrait pour une audience anonyme — aperçu Open Graph, notamment.
 *
 * L'ordre est **parser, retirer, PUIS tronquer**, et c'est une propriété de sécurité, pas
 * une préférence de style. Tronquer d'abord donnerait un `||` orphelin, donc littéral, donc
 * un spoiler affiché en clair dans l'aperçu Discord — au moment précis où le lien est vu par
 * le plus de monde.
 *
 * Le passage masqué est remplacé par un marqueur : l'extrait doit rester lisible, pas
 * amputé sans explication.
 */
export function excerptForAnonymous(body: string, maxLength: number): string {
  // 1. Parser. 2. Retirer.
  const withoutSpoilers = renderForAudience(body, "anonymous")
    .map((segment) => (segment.kind === "text" ? segment.text : "[passage masqué]"))
    .join("");

  const normalized = withoutSpoilers.replace(/\s+/g, " ").trim();

  // 3. Tronquer — seulement maintenant, sur un texte dont plus aucun octet n'est sensible.
  if (normalized.length <= maxLength) {
    return normalized;
  }

  // Couper sur une frontière de mot quand c'est possible, pour ne pas finir sur une syllabe.
  const cut = normalized.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut}…`;
}
