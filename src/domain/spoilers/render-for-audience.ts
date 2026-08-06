import { parseSpoilers } from "./parse-spoilers";

/**
 * LE SEUL chemin d'un texte d'avis vers quelque chose d'affichable — frontière 4.
 *
 * Toute autre voie est un défaut de sécurité, pas un raccourci. Un composant qui recevrait
 * une chaîne brute d'avis et la rendrait directement contournerait tout ce fichier.
 */

/**
 * Qui — ou QUOI — lit.
 *
 * La distinction utile n'est pas « authentifié ou pas », c'est **une page que quelqu'un lit**
 * contre **un résumé fabriqué par une machine**.
 *
 * FR-16 disait à l'origine qu'un passage masqué ne devait pas figurer dans le HTML servi à un
 * visiteur non authentifié, et INV-6 en découlait. La conséquence, jamais pesée : un visiteur
 * ne pouvait **jamais** lire un spoiler, même en cliquant expressément dessus. Victor a
 * tranché le 6 août 2026 en faveur du comportement de Discord — masqué, révélable au clic,
 * pour tout le monde.
 *
 * **Ce qui reste non négociable**, et qui était la vraie menace derrière la règle : l'extrait
 * Open Graph. Un robot en fabrique un aperçu que tout un salon Discord voit sans que personne
 * n'ait cliqué. Là, le texte doit être absent.
 */
export type Audience =
  /** L'auteur de l'avis. Il connaît son propre texte : rien à lui cacher. */
  | "author"
  /** Quelqu'un qui lit une page, connecté ou non. Masqué, révélable au clic. */
  | "reader"
  /**
   * Un résumé fabriqué : description Open Graph, extrait, aperçu. Personne n'a cliqué et le
   * résultat s'affiche à un public entier — le texte masqué doit être ABSENT.
   */
  | "excerpt";

/**
 * Segment prêt à être rendu.
 *
 * Noter `redacted` : il ne porte **aucun champ texte**. C'est la mise en œuvre du
 * durcissement de R-D6, et j'ai choisi l'absence plutôt que la protection.
 *
 * L'exigence d'origine demandait un type enveloppé n'exposant ni `toString`, ni `toJSON`, ni
 * `valueOf`, pour qu'une sérialisation d'action serveur ne le déballe pas silencieusement.
 * Mais un objet qui *contient* le texte tout en interdisant sa lecture reste un objet qui
 * contient le texte : un `structuredClone`, un journal, un message d'erreur ou un futur champ
 * ajouté par distraction suffisent à le ressortir.
 *
 * Ici, pour un extrait, **le texte n'a jamais été mis dans l'objet**. Il n'y a rien à
 * déballer, rien à protéger, et aucune discipline à maintenir.
 */
export type RenderedSegment =
  | { readonly kind: "text"; readonly text: string }
  /** Auteur : le passage s'affiche, discrètement marqué comme masqué pour les autres. */
  | { readonly kind: "revealed"; readonly text: string }
  /** Lecteur : présent dans les octets, à ne jamais peindre avant révélation. */
  | { readonly kind: "spoiler"; readonly text: string }
  /** Extrait : le contenu n'existe pas. Pas de champ `text`, volontairement. */
  | { readonly kind: "redacted" };

/**
 * Détermine l'audience d'un lecteur face à un avis donné.
 *
 * Fonction pure et minuscule, mais elle mérite d'exister séparément : c'est le seul endroit
 * où se décide qui reçoit quoi. Recalculée à la main dans chaque page, la règle finirait par
 * différer d'une surface à l'autre — et l'écart serait exactement le trou.
 *
 * Ne rend jamais `excerpt` : un extrait n'est pas une personne, il se demande explicitement.
 */
export function audienceFor(
  readerId: string | null,
  authorId: string,
): Audience {
  return readerId !== null && readerId === authorId ? "author" : "reader";
}

/**
 * Découpe un texte d'avis selon son audience.
 *
 * ORDRE IMPOSÉ pour un extrait : parser d'abord, retirer ensuite, tronquer en dernier. Ne
 * jamais tronquer avant — D10 rend un `||` non fermé littéral, donc tronquer avant de parser
 * coupe la fermeture et fait apparaître le spoiler en clair. Voir `excerptFor`.
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
      case "reader":
        return { kind: "spoiler", text: segment.text };
      case "excerpt":
        return { kind: "redacted" };
    }
  });
}

/**
 * Extrait destiné à un aperçu — description Open Graph, notamment.
 *
 * L'ordre est **parser, retirer, PUIS tronquer**, et c'est une propriété de sécurité, pas une
 * préférence de style. Tronquer d'abord donnerait un `||` orphelin, donc littéral, donc un
 * spoiler affiché en clair dans l'aperçu Discord — au moment précis où le lien est vu par le
 * plus de monde.
 *
 * Le passage masqué est remplacé par un marqueur : l'extrait doit rester lisible, pas amputé
 * sans explication.
 */
export function excerptFor(body: string, maxLength: number): string {
  // 1. Parser. 2. Retirer.
  const withoutSpoilers = renderForAudience(body, "excerpt")
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
