import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DomainBars } from "~/components/domain-bars";
import { Comments, type CommentForDisplay } from "~/components/comments";
import { Reactions } from "~/components/reactions";
import { ScreenshotGallery } from "~/components/screenshot-gallery";
import { ScorePair } from "~/components/score-pair";
import { SpoilerScope, SpoilerText } from "~/components/spoiler-text";
import { UpdateNoteForm } from "~/components/update-note-form";
import {
  presentAuthorScore,
  presentReaderScore,
} from "~/domain/scoring/present-score";
import {
  audienceFor,
  renderForAudience,
} from "~/domain/spoilers/render-for-audience";
import { isAdmin } from "~/server/auth/is-admin";
import { extraireMentions } from "~/domain/mentions";
import { getComments } from "~/server/db/queries/comments";
import { listGames, titresDeJeux } from "~/server/db/queries/games";
import { getReviewById } from "~/server/db/queries/reviews";
import { noteDeLAuteur } from "~/domain/scoring/synthese-jeu";
import { couvertureSteam } from "~/domain/steam";
import { apercuAvis } from "~/server/apercu-partage";
import { todosParmi } from "~/server/db/queries/todos";
import { getReaderContext } from "~/server/reader";

export const dynamic = "force-dynamic";

/**
 * Aperçu de partage — Open Graph.
 *
 * L'avis est relu SANS session, exactement comme le verrait un robot : c'est la seule façon de
 * s'assurer qu'un avis privé ne décrit rien. `apercuAvis` retombe alors sur les métadonnées du
 * site, ce qui rend le lien indistinguable d'un lien mort — précisément ce qu'on veut.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}): Promise<Metadata> {
  const { reviewId } = await params;
  const avis = await getReviewById(reviewId);

  if (avis === null) {
    return {};
  }

  // Le premier champ REMPLI, dans l'ordre du formulaire — le même choix que dans le fil. Un
  // avis sur un jeu qu'on ne recommande pas ne doit pas produire un aperçu vide.
  const texte =
    avis.whyRecommend ??
    avis.whyNotRecommend ??
    avis.whatMissed ??
    avis.whatHated ??
    null;

  return apercuAvis({
    isPrivate: avis.isPrivate,
    gameTitle: avis.game.title,
    authorName: avis.author.name ?? "Quelqu'un",
    note: noteDeLAuteur(avis),
    texte,
    capture: avis.screenshots[0]?.storageKey ?? null,
    couverture: couvertureSteam(avis.game.steamUrl),
    reviewId,
  });
}

/** Les quatre champs argumentés (FR-4), tous facultatifs et indépendants. */
const argued = [
  { key: "whyRecommend", label: "Pourquoi je le recommande" },
  { key: "whatMissed", label: "Ce qui m'a manqué" },
  { key: "whatHated", label: "Ce que j'ai détesté" },
  { key: "whyNotRecommend", label: "Pourquoi je ne le recommande pas" },
] as const;

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const review = await getReviewById(reviewId);

  if (!review) {
    notFound();
  }

  const reader = await getReaderContext();
  const isAuthor = reader.userId === review.author.id;

  /*
   * Avis privé — FR-17. Seul l'auteur y accède.
   *
   * FR-16 exige une page « avis non public » EXPLICITE, et pas une erreur technique. La
   * différence compte : un lien partagé puis passé en privé doit expliquer ce qui s'est
   * passé, sinon celui qui clique croit que le site est cassé.
   *
   * On ne révèle rien d'autre : ni le jeu, ni l'auteur, ni la date. Le seul fait divulgué est
   * qu'un avis existe à cette adresse — inévitable, puisque l'URL a été partagée.
   */
  if (review.isPrivate && !isAuthor) {
    return (
      <main className="flex flex-col items-start gap-s4 p-s5">
        <h1 className="font-display text-[25px] font-semibold leading-tight">
          Cet avis n&apos;est pas public
        </h1>
        <p className="text-[13px] text-text-muted">
          Son auteur l&apos;a gardé pour lui. Ça arrive — parfois on écrit d&apos;abord pour
          soi.
        </p>
        <Link href="/" className="text-[12px] font-semibold text-accent-text">
          Retour au fil
        </Link>
      </main>
    );
  }

  /*
   * L'audience est décidée UNE FOIS, puis appliquée à tous les champs. La calculer par
   * champ ouvrirait la possibilité qu'un champ soit rendu avec la mauvaise.
   */
  const audience = audienceFor(reader.userId, review.author.id);

  // Chaque champ passe par la fonction d'audience — frontière 4 : c'est le seul chemin d'un
  // texte d'avis vers quelque chose d'affichable.
  const sections = argued.flatMap(({ key, label }) => {
    const body = review[key];

    if (body === null) {
      return [];
    }

    return [{ key, label, segments: renderForAudience(body, audience) }];
  });

  // FR-6 : « tout révéler » agit sur l'avis entier, donc l'information doit être calculée
  // sur l'ensemble des champs, pas champ par champ.
  const hasSpoilers = sections.some((section) =>
    section.segments.some((segment) => segment.kind === "spoiler"),
  );

  const author = presentAuthorScore({
    authorName: review.author.name ?? "Quelqu'un",
    overallScoreManual: review.overallScoreManual,
    domainScores: review.domainScores,
    authorWeighting: review.authorWeighting,
  });

  const readerScore = presentReaderScore(review, reader.name, reader.weighting);

  const admin = await isAdmin(reader.userId);

  // Une seule requête, pour un seul jeu : la fonction en prend un tableau parce que le fil
  // en affiche vingt, mais ici la liste n'a qu'un élément.
  const dansLaListe = (
    await todosParmi(reader.userId, [review.game.id])
  ).has(review.game.id);

  /*
   * DÉCLARÉ AVANT le premier usage, et ce n'est pas une préférence de rangement.
   *
   * Ce format vivait sous la préparation des commentaires, alors qu'une fonction de rappel
   * s'en servait déjà au-dessus. Un `const` est en zone morte tant que sa ligne n'a pas été
   * exécutée : la page tombait en 500 dès qu'un avis recevait son PREMIER commentaire — avec
   * zéro commentaire, la fonction de rappel ne s'exécute jamais et la faute reste invisible.
   *
   * Ni TypeScript ni les tests ne pouvaient l'attraper : le compilateur ne refuse un usage
   * anticipé que s'il est direct, jamais à l'intérieur d'une fermeture, dont il ignore la
   * date d'exécution. Seule une page rendue avec des données réelles le montre.
   */
  const dateFormat: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };

  /*
   * Les commentaires sont préparés ICI, côté serveur, et passés en segments déjà filtrés.
   *
   * Le composant ne reçoit jamais de texte brut : c'est ce qui rend impossible d'afficher un
   * spoiler en clair depuis cette surface, sans avoir à y penser (frontière 4). Et l'audience
   * se calcule par rapport à l'auteur DU COMMENTAIRE, pas à celui de l'avis — c'est lui qui a
   * écrit le passage masqué.
   */
  const commentairesBruts = await getComments(review.id);

  /*
   * Les titres des jeux mentionnés sont résolus EN UNE REQUÊTE pour tout le fil, et à
   * l'affichage plutôt qu'à l'écriture : un titre corrigé par un administrateur se répercute
   * ainsi dans les commentaires déjà publiés.
   */
  const mentions = await titresDeJeux(
    extraireMentions(commentairesBruts.map((c) => c.body)),
  );

  // Le catalogue sert d'autocomplétion. Il naît des avis : un jeu dont personne n'a parlé n'y
  // figure pas, donc ne peut pas être mentionné — c'est la règle que Victor a posée.
  const jeuxMentionnables = (await listGames()).map((g) => ({
    id: g.id,
    title: g.title,
  }));

  const comments: CommentForDisplay[] = commentairesBruts.map(
    (comment) => ({
      id: comment.id,
      segments: renderForAudience(
        comment.body,
        audienceFor(reader.userId, comment.author.id),
      ),
      createdAt: comment.createdAt.toLocaleDateString("fr-FR", dateFormat),
      authorName: comment.author.name ?? "Quelqu'un",
      canDelete: admin || reader.userId === comment.author.id,
    }),
  );

  const playtime: string[] = [];
  if (review.playtimeHours !== null) {
    playtime.push(`${review.playtimeHours} h de jeu`);
  }
  if (review.completed) {
    playtime.push("terminé");
  }

  return (
    <main className="flex flex-col gap-s4 p-s3">
      {/* Tout le corps de l'avis sur UNE surface opaque : sans elle, le titre, les notes
          et les textes se lisaient sur le damier. */}
      <div className="panneau orne relative flex flex-col gap-s5 p-s5">
      <header className="flex flex-col gap-s2">
        <div className="flex items-start justify-between gap-s4">
          <h1 className="font-display text-[25px] font-semibold leading-tight">
            <Link href={`/game/${review.game.id}`} className="lien">
              {review.game.title}
            </Link>
          </h1>

          {/*
            EN HAUT À DROITE, bordé, avec une icône. C'était un lien de texte de 12 px posé
            SOUS la ligne de métadonnées : Victor ne le trouvait pas. Un mot dans un
            paragraphe se lit comme du texte, pas comme une commande — c'est le cadre et la
            place qui font qu'une chose s'active.

            Le crayon est celui que la barre de navigation emploie déjà pour « Écrire » :
            modifier son avis, c'est le même geste sur un texte qui existe déjà.

            L'icône est `aria-hidden` — le mot « Modifier » est juste à côté, et l'annoncer
            deux fois n'apporterait rien à qui écoute la page.
          */}
          {isAuthor ? (
            <Link
              href={`/review/${review.id}/edit`}
              className="flex shrink-0 items-center gap-s2 rounded-[8px] border border-accent px-s4 py-s2 text-[12px] font-semibold text-accent-text hover:bg-accent hover:text-on-accent"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Modifier
            </Link>
          ) : null}
        </div>
        <p className="text-[12px] text-text-muted">
          par{" "}
          {/*
            LE NOM MÈNE AU PROFIL, ici comme dans le fil. Il n'était même pas un lien sur la
            page d'un avis — l'écran où l'on se demande le plus « c'est qui, celui-là, et
            qu'est-ce qu'il aime d'autre ? ». Signalé par Victor.
          */}
          <Link href={`/profile/${review.author.id}`} className="lien">
            {review.author.name ?? "Quelqu'un"}
          </Link>
          {playtime.length > 0 ? <> · {playtime.join(" · ")}</> : null}
          {" · "}
          <time dateTime={review.createdAt.toISOString()}>
            {review.createdAt.toLocaleDateString("fr-FR", dateFormat)}
          </time>
          {/* FR-9 : un avis modifié porte une date de dernière modification VISIBLE. */}
          {review.updatedAt ? (
            <>
              {" · modifié le "}
              <time dateTime={review.updatedAt.toISOString()}>
                {review.updatedAt.toLocaleDateString("fr-FR", dateFormat)}
              </time>
            </>
          ) : null}
        </p>
      </header>

      {author ? (
        <ScorePair author={author} reader={readerScore ?? undefined} />
      ) : (
        <p className="text-[12px] italic text-text-muted">
          Cet avis ne porte aucune note.
        </p>
      )}

      <section className="flex flex-col gap-s3 rounded-[10px] border border-border bg-surface-raised p-s4">
        <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
          Par domaine
        </h2>
        <DomainBars scores={review.domainScores} />
      </section>

      {/* Une seule portée pour tout l'avis : « tout révéler » découvre les passages de TOUS
          les champs, pas seulement celui qu'on a cliqué. */}
      <SpoilerScope hasSpoilers={hasSpoilers}>
        <div className="flex flex-col gap-s5">
          {sections.map(({ key, label, segments }) => (
            <section key={key} className="flex flex-col gap-s2">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
                {label}
              </h2>
              <p className="text-[13px] leading-relaxed">
                <SpoilerText segments={segments} gameTitle={review.game.title} />
              </p>
            </section>
          ))}
        </div>
      </SpoilerScope>

      {/* Notes de mise à jour, après le corps, dans l'ordre chronologique (FR-10). */}
      {review.updateNotes.length > 0 ? (
        <section className="flex flex-col gap-s4">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
            Mises à jour
          </h2>
          {review.updateNotes.map((note) => (
            <article
              key={note.id}
              className="flex flex-col gap-s2 rounded-[10px] border border-border bg-surface-raised p-s4"
            >
              <time
                dateTime={note.createdAt.toISOString()}
                className="text-[11px] text-text-muted"
              >
                {note.createdAt.toLocaleDateString("fr-FR", dateFormat)}
              </time>
              <p className="text-[13px] leading-relaxed">
                <SpoilerText
                  segments={renderForAudience(note.body, audience)}
                  gameTitle={review.game.title}
                />
              </p>
            </article>
          ))}
        </section>
      ) : null}

      {review.screenshots.length > 0 ? (
        <section className="flex flex-col gap-s3">
          <h2 className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
            Captures
          </h2>
          <ScreenshotGallery
            screenshots={review.screenshots}
            gameTitle={review.game.title}
          />
        </section>
      ) : null}

      <Reactions
        reviewId={review.id}
        gameId={review.game.id}
        dejaDansLaListe={dansLaListe}
        reactions={review.reactions}
        viewerId={reader.userId}
        isAuthor={isAuthor}
      />

      {isAuthor ? <UpdateNoteForm reviewId={review.id} /> : null}
      </div>

      {/* Les commentaires portent leur PROPRE panneau : la texture reparaît entre les deux,
          et la discussion se lit comme un bloc distinct de l'avis. */}
      <Comments
        reviewId={review.id}
        gameTitle={review.game.title}
        jeuxMentionnables={jeuxMentionnables}
        mentions={mentions}
        comments={comments}
        canWrite={reader.userId !== null}
      />

      {review.game.steamUrl ? (
        <a
          href={review.game.steamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-accent-text"
        >
          Voir sur Steam →
        </a>
      ) : null}
    </main>
  );
}
