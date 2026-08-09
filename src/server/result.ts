import { type ErrorCode, errorMessages } from "~/messages/fr";

/**
 * Type `Result` discriminé — D9. Forme FIGÉE : ne pas la faire varier d'une action à
 * l'autre.
 *
 * Soit un succès avec ses données, soit un échec porteur d'un code de domaine et d'un
 * message français. **Aucune exception ne traverse la frontière** jusqu'à l'interface.
 *
 * Ce n'est pas un choix esthétique : c'est la contrainte de microcopie qui a décidé de la
 * forme technique. `EXPERIENCE.md` interdit « Network error » et exige que le produit parle
 * comme un pote. Une exception brute ne peut pas satisfaire ça — un `Result` porteur d'un
 * code, si.
 *
 * Bénéfice de bord : chaque cas d'échec devient nommable et testable, et un cas non traité
 * devient une erreur de compilation plutôt qu'un défaut en production.
 */
export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: ErrorCode; readonly message: string };

/** Succès. */
export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

/**
 * Échec. Le message est puisé dans le fichier de libellés, jamais écrit sur place — c'est
 * ce qui garantit qu'on peut relire toutes les formulations d'échec d'un seul coup d'œil.
 */
export function fail<T = never>(code: ErrorCode, detail?: string): Result<T> {
  /*
   * `detail` REMPLACE le message générique, il ne s'y ajoute pas.
   *
   * « Il y a un souci dans ce qui a été saisi. Le lien Steam doit commencer par https:// »
   * fait lire deux fois la même chose, dont une inutile. Le message générique n'a de raison
   * d'être que lorsqu'on ne sait rien de plus précis.
   *
   * Le détail est TOUJOURS écrit par nous, jamais repris d'une bibliothèque : un message de
   * Zod parlerait de types et de chemins d'objet, ce que le glossaire interdit explicitement.
   */
  return { ok: false, code, message: detail ?? errorMessages[code] };
}

/**
 * Vrai si l'erreur est un mécanisme de contrôle de Next et non un échec.
 *
 * R-D9 — LE PIÈGE, et il est vicieux. `redirect()` et `notFound()` de Next **lèvent une
 * exception** pour interrompre le rendu : c'est leur mode de fonctionnement normal. Un
 * `try/catch` attrape-tout autour du corps d'une action — exactement ce que « aucune
 * exception ne traverse » invite à écrire — avale donc le `redirect` et le transforme en
 * échec silencieux. L'utilisateur reste sur place avec un message d'erreur générique, et
 * rien dans les journaux ne dit pourquoi.
 *
 * On reconnaît ces erreurs à leur propriété `digest`, préfixée `NEXT_`. Volontairement
 * détecté par cette convention plutôt qu'en important `isRedirectError` de
 * `next/dist/...` : ce chemin est interne et change entre versions majeures, alors que le
 * préfixe couvre tous les mécanismes de contrôle présents et à venir.
 */
export function isFrameworkControlError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  // Après le `in`, TypeScript sait que la propriété existe : aucune assertion n'est
  // nécessaire, et le lint le refuserait à juste titre.
  const { digest } = error;

  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/**
 * Enveloppe le corps d'une action serveur.
 *
 * Garantit les deux moitiés de D9 d'un seul geste : une erreur inattendue devient
 * `UNEXPECTED` avec un message français, et sa trace part dans les journaux serveur — pas
 * à l'écran. Les erreurs de contrôle du framework, elles, sont **re-lancées** (R-D9).
 *
 * Toute action serveur doit passer par ici. Écrire son propre `try/catch` est la façon la
 * plus simple de réintroduire le défaut que R-D9 décrit.
 */
export async function guard<T>(
  body: () => Promise<Result<T>>,
): Promise<Result<T>> {
  try {
    return await body();
  } catch (error) {
    if (isFrameworkControlError(error)) {
      // Ce n'est pas un échec : c'est une redirection ou un 404 en cours. Le laisser
      // remonter, sinon Next ne peut pas faire son travail.
      throw error;
    }

    // La trace côté serveur, le message générique côté écran.
    console.error("[action] erreur inattendue", error);
    return fail<T>("UNEXPECTED");
  }
}
