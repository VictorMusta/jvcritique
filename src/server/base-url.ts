import { env } from "~/env";

/**
 * L'adresse publique du site.
 *
 * Extraite du module Discord le 10 août 2026, quand les aperçus de partage en ont eu besoin.
 * Une seconde copie aurait divergé le jour d'un changement de domaine, et la divergence se
 * verrait comme « le lien de la notification marche mais celui de l'aperçu est faux » — que
 * personne ne relierait à deux façons de deviner la même adresse.
 *
 * `APP_URL` d'abord, parce qu'elle est DÉCLARÉE. Le repli sur `AUTH_URL` repose sur une
 * convention — qu'elle se termine par `/api/auth` — et une convention finit toujours par être
 * enfreinte. Une adresse fausse dans un aperçu Open Graph est irrécupérable : elle est mise en
 * cache par Discord, Slack et les autres.
 */
export function baseUrl(): string | null {
  if (env.APP_URL) {
    return env.APP_URL.replace(/\/$/, "");
  }

  if (env.AUTH_URL) {
    return env.AUTH_URL.replace(/\/api\/auth\/?$/, "").replace(/\/$/, "");
  }

  return null;
}
