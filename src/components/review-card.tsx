import Link from "next/link";

import {
  presentAuthorScore,
  presentReaderScore,
} from "~/domain/scoring/present-score";
import {
  audienceFor,
  renderForAudience,
} from "~/domain/spoilers/render-for-audience";
import type { Weighting } from "~/domain/types";
import type { ReviewForDisplay } from "~/server/db/queries/reviews";
import { DomainBars } from "./domain-bars";
import { ScorePair } from "./score-pair";
import { CarteCliquable } from "./carte-cliquable";
import { ReviewBody } from "./review-body";

type Props = {
  readonly review: ReviewForDisplay;
  /** Nom du lecteur, ou `null` s'il n'est pas connecté. */
  readonly readerName: string | null;
  /** Identifiant du lecteur, nécessaire pour décider de l'audience des spoilers. */
  readonly readerId: string | null;
  readonly readerWeighting: Weighting;
  /** Le titre du jeu est masqué sur une fiche de jeu, où il est déjà en tête de page. */
  readonly showGameTitle?: boolean;
};

/**
 * Formate le Temps de jeu (FR-22).
 *
 * Affiché partout où l'Avis apparaît avec sa Note globale : c'est un signal de crédibilité,
 * et il doit être lisible AU MÊME MOMENT que la note. Une note de 4/20 après 2 h de jeu et
 * la même après 80 h ne racontent pas la même histoire.
 */
function playtimeLabel(hours: number | null, completed: boolean): string | null {
  const parts: string[] = [];

  if (hours !== null) {
    parts.push(`${hours} h de jeu`);
  }

  if (completed) {
    parts.push("terminé");
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ReviewCard({
  review,
  readerName,
  readerId,
  readerWeighting,
  showGameTitle = true,
}: Props) {
  const audience = audienceFor(readerId, review.author.id);
  const premiere = review.screenshots[0];
  const author = presentAuthorScore({
    authorName: review.author.name ?? "Quelqu'un",
    overallScoreManual: review.overallScoreManual,
    domainScores: review.domainScores,
    authorWeighting: review.authorWeighting,
  });

  // Le lecteur ne voit pas sa propre note en double sur son propre avis : ce serait deux
  // fois le même chiffre côte à côte, avec deux étiquettes différentes.
  const reader =
    readerName !== null && review.author.id !== undefined
      ? presentReaderScore(review, readerName, readerWeighting)
      : null;

  const playtime = playtimeLabel(review.playtimeHours, review.completed);

  /*
   * TOUS LES CHAMPS REMPLIS, dans l'ordre du formulaire.
   *
   * Le premier sert d'aperçu, les autres apparaissent au clic sur « lire la suite ».
   *
   * L'ordre du formulaire est conservé volontairement : c'est celui dans lequel l'auteur a
   * pensé son avis, et le réordonner ferait lire « ce que j'ai détesté » avant « pourquoi je
   * le recommande » sur un avis enthousiaste.
   *
   * Le premier champ rempli devient l'aperçu QUEL QU'IL SOIT — un avis sur un jeu qu'on ne
   * recommande pas apparaissait vide dans le fil, parce que seule la recommandation était
   * regardée.
   */
  const champs = (
    [
      ["Pourquoi je le recommande", review.whyRecommend],
      ["Pourquoi je ne le recommande pas", review.whyNotRecommend],
      ["Ce qui m'a manqué", review.whatMissed],
      ["Ce que j'ai détesté", review.whatHated],
    ] as const
  ).flatMap(([label, body]) =>
    body ? [{ label, segments: renderForAudience(body, audience) }] : [],
  );


  return (
    /*
     * PAS DE BORDURE, et de l'air.
     *
     * Sept conteneurs du produit portaient exactement le même cadre : quand tout a le même
     * poids visuel, plus rien n'a d'importance et l'écran lit comme un gabarit. Depuis que
     * les palettes sont teintées, l'écart entre `surface` et `bg` suffit à détacher la carte
     * — un trait en plus ne ferait que l'enfermer.
     *
     * `orne` pose les deux coins ornés de la variante ; `relative` leur sert de référence.
     */
    <CarteCliquable
      href={`/review/${review.id}`}
      className="orne relative flex cursor-pointer flex-col gap-s4 rounded-md bg-surface p-s5"
    >
      <header className="flex flex-col gap-s1">
        {showGameTitle ? (
          /* Le nom du jeu en grand : c'est ce qu'on cherche en parcourant un fil. */
          <h2 className="font-display text-[21px] font-semibold leading-tight">
            <Link href={`/game/${review.game.id}`} className="lien">
              {review.game.title}
            </Link>
          </h2>
        ) : null}
        <p className="text-[12px] text-text-muted">
          par{" "}
          {/* Le nom mène au profil de son auteur : c'est le chemin naturel pour aller voir
              ce que quelqu'un écrit d'autre, et il n'existait nulle part. */}
          <Link href={`/profile/${review.author.id}`} className="lien">
            {review.author.name ?? "Quelqu'un"}
          </Link>
          {playtime ? <> · {playtime}</> : null}
        </p>
      </header>

      {author ? (
        <ScorePair author={author} reader={reader ?? undefined} />
      ) : (
        <p className="text-[12px] italic text-text-muted">
          Cet avis ne porte aucune note.
        </p>
      )}

      <DomainBars scores={review.domainScores} />

      {/*
        UNE SEULE vignette dans le fil, même s'il y en a dix. Le fil se parcourt : y empiler
        toutes les captures d'un avis noierait les avis suivants. La galerie complète est sur
        la page de l'avis, à un clic.
      */}
      {premiere ? (
        <Link href={`/review/${review.id}`} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/screenshot/${premiere.storageKey}?v=vignette`}
            alt=""
            width={premiere.width}
            height={premiere.height}
            loading="lazy"
            className="aspect-video w-full rounded-[8px] border border-border object-cover"
          />
          {review.screenshots.length > 1 ? (
            <span className="mt-[2px] block text-[11px] text-text-muted">
              +{review.screenshots.length - 1}{" "}
              {review.screenshots.length === 2 ? "autre capture" : "autres captures"}
            </span>
          ) : null}
        </Link>
      ) : null}

      <ReviewBody champs={champs} gameTitle={review.game.title} />

      {/*
        Le lien reste, ET il grossit. Victor le trouvait « trop petit et peu visible » — il
        était à 12 px, sans cadre, au bas d'une carte devenue longue.

        Il ne disparaît pas maintenant que la carte entière est cliquable : c'est LUI le
        chemin accessible. Un gestionnaire de clic sur un conteneur n'est pas atteignable au
        clavier, et le clic sur la carte n'est qu'une commodité posée par-dessus.
      */}
      <Link
        href={`/review/${review.id}`}
        className="flex items-center justify-center gap-s2 rounded-[8px] border border-accent px-s4 py-s3 text-[12px] font-semibold text-accent-text"
      >
        Lire l&apos;avis en entier
        <span aria-hidden>→</span>
      </Link>
    </CarteCliquable>
  );
}
