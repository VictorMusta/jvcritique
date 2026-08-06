"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { computeScore } from "~/domain/scoring/compute-score";
import {
  DOMAIN_KEYS,
  type DomainKey,
  type DomainScores,
  type Weighting,
} from "~/domain/types";
import { bearingHints, comfortHints, domainLabels } from "~/messages/fr";
import { createReviewAction } from "~/server/actions/review";
import { updateReviewAction } from "~/server/actions/review-edit";

/**
 * Les trois états d'une Note de domaine, tenus explicitement dans l'état du formulaire.
 *
 * `value` est conservée même quand l'état est `empty` ou `notApplicable` : ça permet de
 * décocher « pas évaluable » et de retrouver la note qu'on avait posée, au lieu de repartir
 * de zéro. Un formulaire qui oublie ce que l'utilisateur vient de saisir est un formulaire
 * qu'on remplit deux fois.
 */
type DomainEntry = {
  state: "empty" | "rated" | "notApplicable";
  value: number;
};

/**
 * Valeurs de départ en modification (FR-9).
 *
 * FR-9 est explicite : « la modification réutilise le formulaire de création, prérempli avec
 * les valeurs existantes ; il n'existe pas d'écran d'édition distinct ». Un second formulaire
 * aurait divergé du premier au bout de deux évolutions.
 */
export type ReviewFormInitial = {
  readonly reviewId: string;
  readonly gameTitle: string;
  readonly steamUrl: string | null;
  readonly overallScoreManual: number | null;
  readonly playtimeHours: number | null;
  readonly completed: boolean;
  readonly whyRecommend: string | null;
  readonly whatMissed: string | null;
  readonly whatHated: string | null;
  readonly whyNotRecommend: string | null;
  readonly domainScores: DomainScores;
};

const entriesFrom = (scores: DomainScores | undefined) => {
  const entries = {} as Record<DomainKey, DomainEntry>;

  for (const key of DOMAIN_KEYS) {
    const score = scores?.[key];

    if (score?.kind === "rated") {
      entries[key] = { state: "rated", value: score.value };
    } else if (score?.kind === "notApplicable") {
      entries[key] = { state: "notApplicable", value: 10 };
    } else {
      entries[key] = { state: "empty", value: 10 };
    }
  }

  return entries;
};

export function ReviewForm({
  authorName,
  authorWeighting,
  initial,
}: {
  readonly authorName: string;
  readonly authorWeighting: Weighting;
  /** Absent en création, présent en modification. */
  readonly initial?: ReviewFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editing = initial !== undefined;

  const [gameTitle, setGameTitle] = useState(initial?.gameTitle ?? "");
  const [steamUrl, setSteamUrl] = useState(initial?.steamUrl ?? "");
  const [entries, setEntries] = useState<Record<DomainKey, DomainEntry>>(() =>
    entriesFrom(initial?.domainScores),
  );
  const [manualMode, setManualMode] = useState(
    initial?.overallScoreManual !== null && initial?.overallScoreManual !== undefined,
  );
  const [manualScore, setManualScore] = useState(initial?.overallScoreManual ?? 14);
  const [playtime, setPlaytime] = useState(
    initial?.playtimeHours !== null && initial?.playtimeHours !== undefined
      ? String(initial.playtimeHours)
      : "",
  );
  const [completed, setCompleted] = useState(initial?.completed ?? false);
  const [texts, setTexts] = useState({
    whyRecommend: initial?.whyRecommend ?? "",
    whatMissed: initial?.whatMissed ?? "",
    whatHated: initial?.whatHated ?? "",
    whyNotRecommend: initial?.whyNotRecommend ?? "",
  });

  /**
   * Le message « une case pas évaluable existe » ne se montre QU'UNE FOIS par session, au
   * premier curseur amené à zéro.
   *
   * Et il ne doit pas se lire comme une correction : zéro est une note parfaitement
   * légitime. On signale l'existence d'une autre possibilité, on ne reproche rien.
   */
  const [zeroHintShown, setZeroHintShown] = useState(false);

  const domainScores: DomainScores = useMemo(() => {
    const scores: Partial<Record<DomainKey, DomainScores[DomainKey]>> = {};
    for (const key of DOMAIN_KEYS) {
      const entry = entries[key];
      if (entry.state === "rated") {
        scores[key] = { kind: "rated", value: entry.value };
      } else if (entry.state === "notApplicable") {
        scores[key] = { kind: "notApplicable" };
      }
    }
    return scores;
  }, [entries]);

  /**
   * Aperçu de la note calculée, EN DIRECT et côté client.
   *
   * C'est le seul endroit du produit où le calcul côté client est le bon choix : l'auteur
   * manipule ses propres notes, avec sa propre pondération, et il doit voir l'effet de
   * chaque curseur sans aller-retour réseau. La fonction appelée est la MÊME que celle du
   * serveur — pas une réimplémentation — donc l'aperçu ne peut pas mentir.
   */
  const preview = useMemo(
    () => computeScore(domainScores, authorWeighting),
    [domainScores, authorWeighting],
  );

  function setEntry(domain: DomainKey, next: Partial<DomainEntry>) {
    setEntries((previous) => ({
      ...previous,
      [domain]: { ...previous[domain], ...next },
    }));
  }

  function onSliderChange(domain: DomainKey, raw: string) {
    const value = Number(raw);

    if (value === 0 && !zeroHintShown) {
      setZeroHintShown(true);
    }

    setEntry(domain, { state: "rated", value });
  }

  const hasAnyScore =
    manualMode || Object.values(entries).some((e) => e.state === "rated");

  function submit() {
    setError(null);

    const payload = {
      gameTitle,
      steamUrl,
      overallScoreManual: manualMode ? manualScore : null,
      playtimeHours: playtime.trim() === "" ? null : Number(playtime),
      completed,
      ...texts,
      domainScores: DOMAIN_KEYS.flatMap((domain) => {
        const entry = entries[domain];
        if (entry.state === "empty") {
          // Un domaine vide n'est PAS envoyé : l'absence est sa représentation, en base
          // comme dans le moteur de notation.
          return [];
        }
        return [
          {
            domain,
            value: entry.state === "rated" ? entry.value : null,
            notApplicable: entry.state === "notApplicable",
          },
        ];
      }),
    };

    startTransition(async () => {
      const result = initial
        ? await updateReviewAction(initial.reviewId, payload)
        : await createReviewAction(payload);

      if (result.ok) {
        router.push(`/review/${result.data.reviewId}`);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-s6">
      {/* --- Le jeu (FR-11) --- */}
      <section className="flex flex-col gap-s3">
        <label htmlFor="gameTitle" className="font-display text-[15px] font-semibold">
          Quel jeu ?
        </label>
        <input
          id="gameTitle"
          value={gameTitle}
          onChange={(e) => setGameTitle(e.target.value)}
          placeholder="Valheim"
          /*
           * Le jeu ne change pas en modification : changer le jeu d'un avis, c'est écrire un
           * autre avis. La contrainte d'unicité (auteur, jeu) le refuserait de toute façon —
           * autant l'empêcher ici plutôt que d'échouer après coup.
           */
          disabled={editing}
          className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px] disabled:text-text-muted"
        />
        {editing ? (
          <p className="text-[11px] italic text-text-muted">
            Le jeu ne se change pas. Pour parler d&apos;un autre jeu, écris un nouvel avis.
          </p>
        ) : null}
        <label htmlFor="steamUrl" className="text-[12px] text-text-muted">
          Lien Steam
        </label>
        <input
          id="steamUrl"
          value={steamUrl}
          onChange={(e) => setSteamUrl(e.target.value)}
          placeholder="https://store.steampowered.com/app/…"
          className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px]"
        />
        <p className="text-[11px] italic text-text-muted">{comfortHints.optional}</p>
      </section>

      {/* --- Les sept domaines (FR-4) --- */}
      <section className="flex flex-col gap-s4">
        <div className="flex flex-col gap-s2">
          <h2 className="font-display text-[15px] font-semibold">Par domaine</h2>
          <p className="text-[12px] italic leading-snug text-text">
            {bearingHints.emptyDomain}
          </p>
        </div>

        {DOMAIN_KEYS.map((domain) => {
          const entry = entries[domain];

          return (
            <div key={domain} className="flex flex-col">
              <div className="flex items-baseline justify-between gap-s4">
                <label
                  htmlFor={`score-${domain}`}
                  className="text-[12px] text-text-muted"
                >
                  {domainLabels[domain]}
                </label>
                <div className="flex items-center gap-s4">
                  <span className="tnum text-[12px] font-semibold">
                    {entry.state === "rated" ? entry.value : "—"}
                  </span>
                  <label className="flex items-center gap-s2 text-[11px] text-text-muted">
                    <input
                      type="checkbox"
                      checked={entry.state === "notApplicable"}
                      onChange={(e) =>
                        setEntry(domain, {
                          state: e.target.checked ? "notApplicable" : "empty",
                        })
                      }
                    />
                    pas évaluable
                  </label>
                </div>
              </div>
              <input
                id={`score-${domain}`}
                className="domain-slider"
                type="range"
                min={0}
                max={20}
                step={1}
                // L'état vide a une apparence DISTINCTE de la valeur 0 : sans ça, un curseur
                // non touché serait indiscernable d'un « je mets zéro », et les deux ne
                // produisent pas la même note.
                data-empty={entry.state !== "rated"}
                disabled={entry.state === "notApplicable"}
                value={entry.value}
                onChange={(e) => onSliderChange(domain, e.target.value)}
              />
            </div>
          );
        })}

        {zeroHintShown ? (
          <p
            aria-live="polite"
            className="rounded-[8px] border border-border bg-surface p-s3 text-[12px] italic leading-snug text-text"
          >
            {bearingHints.notApplicableExists}
          </p>
        ) : null}
      </section>

      {/* --- La note globale (FR-5) --- */}
      <section className="flex flex-col gap-s3">
        <h2 className="font-display text-[15px] font-semibold">La note globale</h2>

        <label className="flex items-center gap-s3 text-[12px]">
          <input
            type="checkbox"
            checked={manualMode}
            onChange={(e) => setManualMode(e.target.checked)}
          />
          Je la mets moi-même
        </label>

        {manualMode ? (
          <div className="flex items-center gap-s4">
            <input
              type="number"
              min={0}
              max={20}
              value={manualScore}
              onChange={(e) => setManualScore(Number(e.target.value))}
              aria-label="Note globale sur 20"
              className="tnum w-[80px] rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[16px] font-bold"
            />
            <span className="text-[12px] text-text-muted">/ 20</span>
          </div>
        ) : (
          <div className="flex flex-col gap-s1 rounded-[8px] border border-border bg-surface-raised px-s4 py-s3">
            {preview.mode === "none" ? (
              <p className="text-[12px] italic text-text-muted">
                Note aucun domaine et la note globale ne peut pas se calculer. Mets-la
                toi-même, ou note au moins un domaine.
              </p>
            ) : (
              <>
                <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-text-muted">
                  {authorName}
                </span>
                <span className="tnum text-[34px] font-bold leading-none">
                  {preview.score.toLocaleString("fr-FR", {
                    maximumFractionDigits: 1,
                  })}
                  <span className="text-[13px] font-normal text-text-muted"> / 20</span>
                </span>
                <span className="text-[11px] italic text-text-muted">
                  {preview.mode === "simpleMean"
                    ? `Moyenne simple sur ${preview.domainsUsed.length} domaine(s) — tes critères ne couvrent aucun domaine noté.`
                    : `Calculée sur ${preview.domainsUsed.length} domaine(s), selon tes critères.`}
                </span>
              </>
            )}
          </div>
        )}
      </section>

      {/* --- Temps de jeu (FR-22) --- */}
      <section className="flex flex-col gap-s3">
        <h2 className="font-display text-[15px] font-semibold">Ton temps de jeu</h2>
        <div className="flex items-center gap-s4">
          <input
            type="number"
            min={0}
            value={playtime}
            onChange={(e) => setPlaytime(e.target.value)}
            aria-label="Heures de jeu"
            className="tnum w-[100px] rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px]"
          />
          <span className="text-[12px] text-text-muted">heures</span>
        </div>
        <label className="flex items-center gap-s3 text-[12px]">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
          />
          Je l&apos;ai terminé
        </label>
        {/* Les deux sont indépendants : 40 h sans finir, 6 h et fini. */}
        <p className="text-[11px] italic text-text-muted">
          {comfortHints.playtimeFree}
        </p>
      </section>

      {/* --- Les quatre champs argumentés (FR-4) --- */}
      <section className="flex flex-col gap-s5">
        <h2 className="font-display text-[15px] font-semibold">Tes arguments</h2>

        {(
          [
            ["whyRecommend", "Pourquoi je le recommande"],
            ["whatMissed", "Ce qui m'a manqué"],
            ["whatHated", "Ce que j'ai détesté"],
            ["whyNotRecommend", "Pourquoi je ne le recommande pas"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex flex-col gap-s2">
            <label htmlFor={key} className="text-[12px] text-text-muted">
              {label}
            </label>
            <textarea
              id={key}
              rows={3}
              value={texts[key]}
              onChange={(e) =>
                setTexts((previous) => ({ ...previous, [key]: e.target.value }))
              }
              className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px] leading-relaxed"
            />
          </div>
        ))}
        {/* Mention PORTEUSE : la syntaxe des spoilers change ce que les autres verront. */}
        <p className="text-[12px] italic leading-snug text-text">
          {bearingHints.spoilerSyntax}
        </p>
        <p className="text-[11px] italic text-text-muted">
          Tous facultatifs et indépendants. Remplis ceux qui te viennent.
        </p>
      </section>

      <div className="flex flex-col gap-s3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || gameTitle.trim() === "" || !hasAnyScore}
          className="rounded-[8px] border border-accent bg-accent px-s5 py-[13px] font-semibold text-bg disabled:opacity-50"
        >
          {pending
            ? editing
              ? "Enregistrement…"
              : "Publication…"
            : editing
              ? "Enregistrer les modifications"
              : "Publier"}
        </button>

        {/* Le bouton dit POURQUOI il est inactif. Un bouton grisé sans explication laisse
            l'utilisateur chercher ce qu'il a raté. */}
        {gameTitle.trim() === "" ? (
          <p className="text-[11px] italic text-text-muted">
            Il manque le nom du jeu.
          </p>
        ) : !hasAnyScore ? (
          <p className="text-[11px] italic text-text">
            Il faut au moins une note : mets la note globale toi-même, ou note un domaine.
          </p>
        ) : null}

        {error ? (
          <p aria-live="polite" className="text-[12px] text-negative">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
