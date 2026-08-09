import { excerptFor } from "~/domain/spoilers/render-for-audience";
import { env } from "~/env";

/**
 * Annonce d'un nouvel avis dans un salon Discord — FR-19, par webhook.
 *
 * POURQUOI DISCORD ET PAS UNE NOTIFICATION DANS L'APPLICATION. Le PRD limitait les
 * notifications à l'in-app, ce qui ne prévient que quelqu'un qui est DÉJÀ dans
 * l'application — c'est-à-dire exactement la personne qui n'a pas besoin d'être prévenue.
 * Le canal qui ramène les gens existe déjà : ils y sont toute la journée.
 *
 * TROIS RÈGLES, dont deux sont des propriétés de sécurité.
 */

/** Au-delà, on abandonne : publier un avis ne doit pas attendre Discord. */
const DELAI_MS = 3000;

type Annonce = {
  reviewId: string;
  gameTitle: string;
  authorName: string;
  /** Note affichée, ou `null` si l'avis n'en porte pas. */
  score: number | null;
  /** Corps brut de l'avis — il sera filtré ici, jamais avant. */
  body: string | null;
  isPrivate: boolean;
};

/** Base publique du site, pour composer le lien de l'avis. */
function baseUrl(): string | null {
  if (env.APP_URL) {
    return env.APP_URL.replace(/\/$/, "");
  }

  // Repli : `AUTH_URL` vaut « https://…/api/auth » par convention du projet.
  if (env.AUTH_URL) {
    return env.AUTH_URL.replace(/\/api\/auth\/?$/, "").replace(/\/$/, "");
  }

  return null;
}

/**
 * Publie l'annonce. Ne lève JAMAIS.
 *
 * Un avis publié dont l'annonce échoue reste un avis publié : Discord indisponible, webhook
 * révoqué ou réseau capricieux ne doivent pas transformer une publication réussie en erreur
 * à l'écran. La trace part dans les journaux serveur.
 */
export async function annoncerAvis(annonce: Annonce): Promise<void> {
  /*
   * RÈGLE 1 — un avis privé n'est JAMAIS annoncé.
   *
   * Ce serait la fuite la plus bête possible : le contenu resterait protégé, mais le salon
   * apprendrait que Victor vient d'écrire sur tel jeu, avec sa note. Le contrôle est ici, au
   * plus près de l'envoi, plutôt que chez l'appelant — un appelant peut oublier.
   */
  if (annonce.isPrivate) {
    return;
  }

  const url = env.DISCORD_WEBHOOK_URL;

  // Sans webhook configuré, la fonctionnalité n'existe simplement pas. Ce n'est pas une
  // panne : c'est un état valide, et c'est le défaut.
  if (!url) {
    return;
  }

  const base = baseUrl();
  const lien = base ? `${base}/review/${annonce.reviewId}` : null;

  /*
   * RÈGLE 2 — l'extrait passe par la fonction d'audience « extrait ».
   *
   * C'est LE cas pour lequel cette audience a été créée : un robot fabrique un aperçu que
   * tout un salon voit sans que personne n'ait cliqué. Un spoiler y serait lu par tout le
   * monde, d'un coup, sans recours. L'ordre parser → retirer → tronquer est respecté par
   * `excerptFor` : tronquer d'abord couperait la fermeture d'un `||`, le rendrait littéral,
   * et afficherait le passage en clair.
   */
  const extrait = annonce.body ? excerptFor(annonce.body, 280) : null;

  const note =
    annonce.score === null
      ? null
      : `${annonce.score.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 20`;

  const corps = {
    // Pas de `content` : le message n'a pas de texte hors de l'encart, ce qui évite les
    // mentions accidentelles.
    embeds: [
      {
        title: annonce.gameTitle,
        url: lien ?? undefined,
        description: extrait ?? undefined,
        color: 0xc98a3c,
        author: { name: `${annonce.authorName} vient de publier un avis` },
        fields: note ? [{ name: "Sa note", value: note, inline: true }] : undefined,
      },
    ],
    // Neutralise toute mention que contiendrait un titre de jeu ou un extrait : personne ne
    // doit pouvoir déclencher un @everyone en nommant son avis.
    allowed_mentions: { parse: [] },
  };

  try {
    /*
     * RÈGLE 3 — délai borné.
     *
     * Discord limite ses webhooks à quelques requêtes par seconde. À cinq amis, on n'en
     * approche jamais : un avis se publie en une minute, pas en une milliseconde. La borne
     * ici ne protège pas Discord, elle protège l'utilisateur — publier ne doit pas attendre
     * un service tiers.
     */
    const reponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(DELAI_MS),
    });

    if (!reponse.ok) {
      console.error(
        "[discord] annonce refusée",
        reponse.status,
        await reponse.text().catch(() => ""),
      );
    }
  } catch (erreur) {
    console.error("[discord] annonce impossible", erreur);
  }
}
