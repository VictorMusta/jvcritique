import type { Metadata } from "next";

import { excerptFor } from "~/domain/spoilers/render-for-audience";
import { baseUrl } from "~/server/base-url";

/**
 * Aperçus de partage — Open Graph. Demandé par Victor le 10 août 2026 : il avait collé un lien
 * d'avis sur Discord, et l'encart affichait la description générique du site.
 *
 * C'EST LE CAS POUR LEQUEL L'AUDIENCE « EXTRAIT » A ÉTÉ ÉCRITE. On RETIRE les passages
 * masqués, on ne les masque pas — contrairement à l'annonce dans le salon, où Discord sait
 * dessiner un rectangle cliquable. Une description Open Graph est du texte brut : aucun client
 * ne sait y cacher quoi que ce soit, et le passage arriverait en clair sous les yeux de tout un
 * salon qui n'a rien demandé.
 *
 * C'est aussi le cas exact que FR-16 et INV-6 avaient en tête. Le reste de la règle a été
 * assoupli par Victor le 6 août — un lecteur peut révéler un spoiler en cliquant — mais
 * l'aperçu, lui, n'a jamais été négociable : personne n'y clique.
 */

/** Longueur d'une description Open Graph avant que les clients ne la coupent eux-mêmes. */
const LONGUEUR = 200;

/**
 * Métadonnées d'un avis, ou celles du site si l'avis ne doit pas être décrit.
 *
 * UN AVIS PRIVÉ NE FUITE RIEN — ni titre, ni note, ni texte. C'est la propriété qui compte
 * ici : ces métadonnées sont produites pour un robot, sans session, et un robot n'a jamais de
 * droit de lecture. Retomber sur la description générique le rend indistinguable d'un lien
 * mort, ce qui est exactement ce qu'on veut.
 */
export function apercuAvis(
  avis: {
    isPrivate: boolean;
    gameTitle: string;
    authorName: string;
    note: number | null;
    /** Le premier champ rempli, brut. Il sera filtré ici, jamais avant. */
    texte: string | null;
    /** Clé de la première capture, s'il y en a une. */
    capture: string | null;
    /** Couverture Steam, en repli. */
    couverture: string | null;
    reviewId: string;
  } | null,
): Metadata {
  if (avis === null || avis.isPrivate) {
    return {};
  }

  const note =
    avis.note === null
      ? null
      : `${avis.note.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}/20`;

  const titre = note
    ? `${avis.gameTitle} — ${note} par ${avis.authorName}`
    : `${avis.gameTitle} — l'avis de ${avis.authorName}`;

  /*
   * Parser → retirer → tronquer, dans cet ordre, et `excerptFor` le garantit. Tronquer
   * d'abord couperait la fermeture d'un `||`, le rendrait littéral, et afficherait le passage
   * en clair — au moment précis où le lien est vu par le plus de monde.
   */
  const description =
    avis.texte === null
      ? `Son avis sur ${avis.gameTitle}, noté selon TES critères.`
      : excerptFor(avis.texte, LONGUEUR);

  const base = baseUrl();

  return {
    title: titre,
    description,
    openGraph: {
      title: titre,
      description,
      type: "article",
      url: base ? `${base}/review/${avis.reviewId}` : undefined,
      siteName: "jvcritiqué",
      /*
       * Une VRAIE capture d'abord, la jaquette Steam ensuite. La première vient de quelqu'un
       * qui a joué ; la seconde comble un vide. Et l'image doit être ABSOLUE : un chemin
       * relatif n'est pas résolu par les robots, qui n'ont pas de page de référence.
       */
      images: imagesDe(avis, base),
    },
    twitter: {
      card: "summary_large_image",
      title: titre,
      description,
    },
  };
}

function imagesDe(
  avis: { capture: string | null; couverture: string | null },
  base: string | null,
): string[] | undefined {
  if (avis.capture !== null && base !== null) {
    return [`${base}/api/screenshot/${avis.capture}?v=vignette`];
  }

  // La couverture Steam est déjà une adresse absolue, elle n'a pas besoin de la base.
  if (avis.couverture !== null) {
    return [avis.couverture];
  }

  return undefined;
}

/**
 * Métadonnées d'une fiche de jeu.
 *
 * La moyenne y figure AVEC SON ÉCHANTILLON, comme partout ailleurs : « 16,4/20 sur 3 avis »
 * plutôt qu'un chiffre nu. INV-5 vaut aussi dans un encart Discord — c'est même là qu'il vaut
 * le plus, puisque personne ne peut cliquer pour voir d'où sort le chiffre.
 */
export function apercuJeu(jeu: {
  gameId: string;
  title: string;
  moyenne: { valeur: number; echantillon: number } | null;
  capture: string | null;
  couverture: string | null;
}): Metadata {
  const base = baseUrl();

  const description =
    jeu.moyenne === null
      ? `Les avis de tes potes sur ${jeu.title}, notés selon TES critères.`
      : `${jeu.moyenne.valeur.toLocaleString("fr-FR", {
          maximumFractionDigits: 1,
        })}/20 en moyenne sur ${jeu.moyenne.echantillon} ${
          jeu.moyenne.echantillon === 1 ? "avis" : "avis"
        }. Chacun garde la sienne.`;

  return {
    title: jeu.title,
    description,
    openGraph: {
      title: `${jeu.title} — sur jvcritiqué`,
      description,
      type: "website",
      url: base ? `${base}/game/${jeu.gameId}` : undefined,
      siteName: "jvcritiqué",
      images: imagesDe(jeu, base),
    },
    twitter: {
      card: "summary_large_image",
      title: jeu.title,
      description,
    },
  };
}
