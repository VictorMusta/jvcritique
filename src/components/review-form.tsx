"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

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
import type { NewScreenshot } from "~/server/db/queries/reviews";
import { ScreenshotPicker } from "./screenshot-picker";
import {
  ecrireBrouillon,
  effacerBrouillon,
  lireBrouillon,
} from "./brouillon";
import { useSliderGesture } from "./use-slider-gesture";

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
  readonly isPrivate: boolean;
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
  readonly screenshots: readonly NewScreenshot[];
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

/** Un jeu déjà au catalogue, pour l'aide à la saisie. */
export type ExistingGame = {
  readonly id: string;
  readonly title: string;
  readonly reviewCount: number;
};

/** Normalisation identique à celle de la base : minuscules, espaces des bords retirés. */
const normalise = (s: string) => s.trim().toLowerCase();

/**
 * Remet un brouillon en forme depuis une valeur quelconque.
 *
 * `localStorage` est une frontière : ce qui en sort a le type qu'on VEUT BIEN lui prêter, pas
 * celui qu'il a. Chaque champ est donc repris seulement s'il ressemble à ce qu'on attend, et
 * la forme vierge sert de filet pour tous les autres.
 */
function normaliserBrouillon(brut: unknown, vierge: BrouillonAvis): BrouillonAvis {
  const b = (brut ?? {}) as Partial<Record<keyof BrouillonAvis, unknown>>;

  const chaine = (valeur: unknown, defaut: string) =>
    typeof valeur === "string" ? valeur : defaut;
  const booleen = (valeur: unknown, defaut: boolean) =>
    typeof valeur === "boolean" ? valeur : defaut;

  // Les sept domaines existent TOUJOURS, quoi qu'ait contenu le brouillon : le formulaire
  // rend un curseur par domaine et lit `entries[cle].state` sans se demander s'il est là.
  const entries = { ...vierge.entries };
  const entreesBrutes = (b.entries ?? {}) as Record<string, unknown>;

  for (const cle of DOMAIN_KEYS) {
    const entree = entreesBrutes[cle] as { state?: unknown; value?: unknown } | undefined;

    if (
      entree !== undefined &&
      (entree.state === "empty" ||
        entree.state === "rated" ||
        entree.state === "notApplicable") &&
      typeof entree.value === "number" &&
      Number.isFinite(entree.value)
    ) {
      entries[cle] = { state: entree.state, value: entree.value };
    }
  }

  const textesBruts = (b.texts ?? {}) as Record<string, unknown>;

  return {
    gameTitle: chaine(b.gameTitle, vierge.gameTitle),
    steamUrl: chaine(b.steamUrl, vierge.steamUrl),
    entries,
    manualMode: booleen(b.manualMode, vierge.manualMode),
    // Un `NaN` sérialisé devient `null`, et les brouillons d'avant le passage en chaîne
    // portent un nombre. Les deux retombent sur la valeur vierge.
    manualScore:
      typeof b.manualScore === "string"
        ? b.manualScore
        : typeof b.manualScore === "number"
          ? String(b.manualScore)
          : vierge.manualScore,
    playtime: chaine(b.playtime, vierge.playtime),
    completed: booleen(b.completed, vierge.completed),
    screenshots: Array.isArray(b.screenshots)
      ? (b.screenshots.filter(
          (image) =>
            typeof (image as { storageKey?: unknown })?.storageKey === "string",
        ) as NewScreenshot[])
      : vierge.screenshots,
    isPrivate: booleen(b.isPrivate, vierge.isPrivate),
    texts: {
      whyRecommend: chaine(textesBruts.whyRecommend, ""),
      whatMissed: chaine(textesBruts.whatMissed, ""),
      whatHated: chaine(textesBruts.whatHated, ""),
      whyNotRecommend: chaine(textesBruts.whyNotRecommend, ""),
    },
  };
}

/** Ce qui est conservé sur l'appareil pendant la frappe. */
type BrouillonAvis = {
  gameTitle: string;
  steamUrl: string;
  entries: Record<DomainKey, DomainEntry>;
  manualMode: boolean;
  manualScore: string;
  playtime: string;
  completed: boolean;
  screenshots: NewScreenshot[];
  isPrivate: boolean;
  texts: {
    whyRecommend: string;
    whatMissed: string;
    whatHated: string;
    whyNotRecommend: string;
  };
};

export function ReviewForm({
  authorName,
  authorWeighting,
  initial,
  existingGames = [],
  titreJeuPropose,
}: {
  readonly authorName: string;
  readonly authorWeighting: Weighting;
  /** Absent en création, présent en modification. */
  readonly initial?: ReviewFormInitial;
  readonly existingGames?: readonly ExistingGame[];
  /**
   * Titre proposé d'avance, quand on arrive depuis la fiche d'un jeu.
   *
   * Sans lui, le bouton « Donner mon avis » d'une fiche ouvrirait un formulaire vide et il
   * faudrait retaper le nom — au risque d'une variante qui créerait une SECONDE fiche pour
   * le même jeu. Le catalogue se dédoublerait précisément à l'endroit prévu pour l'éviter.
   */
  readonly titreJeuPropose?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** Vrai quand recharger la page est le geste qui répare, et non un simple réessai. */
  const [errorRechargeable, setErrorRechargeable] = useState(false);
  const editing = initial !== undefined;

  // Un seul exemplaire pour les sept curseurs : il n'y a qu'un doigt à la fois, et les
  // règles des crochets interdisent d'en appeler un dans une boucle.
  const gesture = useSliderGesture();

  const [gameTitle, setGameTitle] = useState(
    initial?.gameTitle ?? titreJeuPropose ?? "",
  );
  const [steamUrl, setSteamUrl] = useState(initial?.steamUrl ?? "");
  const [entries, setEntries] = useState<Record<DomainKey, DomainEntry>>(() =>
    entriesFrom(initial?.domainScores),
  );
  const [manualMode, setManualMode] = useState(
    initial?.overallScoreManual !== null && initial?.overallScoreManual !== undefined,
  );
  /*
   * Conservée comme CHAÎNE, et pas comme nombre.
   *
   * C'est ce que l'utilisateur tape, et c'est la seule représentation qui survit à une
   * frappe intermédiaire. Un `Number()` posé sur chaque touche rendait `NaN` dès qu'une
   * virgule apparaissait — « 16,5 ». Le `NaN` entrait dans l'état, `JSON.stringify` le
   * changeait en `null` dans le brouillon, et au retour la note personnalisée était vide
   * alors que la case restait cochée. L'avis était refusé pour « aucune note », avec un
   * message générique qui ne désignait rien.
   *
   * Signalé par Victor le 9 août 2026, après que son ami Leny soit resté bloqué dessus.
   */
  const [manualScore, setManualScore] = useState(
    initial?.overallScoreManual !== null && initial?.overallScoreManual !== undefined
      ? String(initial.overallScoreManual)
      : "14",
  );
  const [playtime, setPlaytime] = useState(
    initial?.playtimeHours !== null && initial?.playtimeHours !== undefined
      ? String(initial.playtimeHours)
      : "",
  );
  const [completed, setCompleted] = useState(initial?.completed ?? false);
  const [screenshots, setScreenshots] = useState<NewScreenshot[]>(
    () => [...(initial?.screenshots ?? [])],
  );
  // Public par défaut (FR-17).
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
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

  /*
   * BROUILLON LOCAL — Hugo perdait tout son texte quand la publication échouait pendant un
   * déploiement et qu'il rechargeait la page.
   *
   * La clé distingue la création de la modification d'un avis précis : sans cela, un
   * brouillon de création réapparaîtrait par-dessus une modification, ou l'inverse.
   */
  const cleBrouillon = initial ? `modif-${initial.reviewId}` : "nouveau";

  /**
   * Le brouillon trouvé, EN ATTENTE DE DÉCISION — il n'est pas appliqué tout seul.
   *
   * Première version : il était repris d'office, avec un bandeau qui l'annonçait après coup.
   * Victor a demandé l'inverse, et il a raison — on ne remplit pas le formulaire de quelqu'un
   * sans le lui demander. Surtout quand on peut se tromper : le bandeau s'affichait sur un
   * formulaire vide, parce qu'un brouillon vide était quand même un brouillon.
   */
  const [brouillonPropose, setBrouillonPropose] = useState<BrouillonAvis | null>(
    null,
  );

  /*
   * Empêche la sauvegarde de s'exécuter AVANT la lecture.
   *
   * Les deux effets tournent dans la même phase, avec le même état : sans ce verrou, la
   * sauvegarde écrirait le formulaire vide par-dessus le brouillon qu'on est en train de
   * lire. Un `ref` et pas un état — le basculer ne doit pas provoquer de rendu.
   */
  const pretAEcrire = useRef(false);

  /** Le formulaire tel qu'il naît, avant toute frappe. Sert de point de comparaison. */
  const vierge = useCallback(
    (): BrouillonAvis => ({
      gameTitle: initial?.gameTitle ?? titreJeuPropose ?? "",
      steamUrl: initial?.steamUrl ?? "",
      entries: entriesFrom(initial?.domainScores),
      manualMode:
        initial?.overallScoreManual !== null &&
        initial?.overallScoreManual !== undefined,
      manualScore:
        initial?.overallScoreManual !== null &&
        initial?.overallScoreManual !== undefined
          ? String(initial.overallScoreManual)
          : "14",
      playtime:
        initial?.playtimeHours !== null && initial?.playtimeHours !== undefined
          ? String(initial.playtimeHours)
          : "",
      completed: initial?.completed ?? false,
      screenshots: [...(initial?.screenshots ?? [])],
      isPrivate: initial?.isPrivate ?? false,
      texts: {
        whyRecommend: initial?.whyRecommend ?? "",
        whatMissed: initial?.whatMissed ?? "",
        whatHated: initial?.whatHated ?? "",
        whyNotRecommend: initial?.whyNotRecommend ?? "",
      },
    }),
    [initial, titreJeuPropose],
  );

  /*
   * La lecture se fait dans un effet, jamais à l'initialisation de l'état.
   *
   * `localStorage` n'existe pas sur le serveur : lire à l'initialisation produirait un rendu
   * serveur et un rendu client différents, donc une erreur d'hydratation.
   */
  useEffect(() => {
    const trouve = lireBrouillon<BrouillonAvis>(cleBrouillon);

    /*
     * UN BROUILLON VIDE N'EST PAS UN BROUILLON.
     *
     * C'est le défaut que Victor a vu : « j'ai ce message alors que mon formulaire est
     * vide ». Ouvrir la page suffisait à en créer un — la sauvegarde s'exécutait juste après
     * la lecture et enregistrait le formulaire tel quel. La visite suivante trouvait donc
     * bien quelque chose, et le proposait.
     *
     * On compare à la forme VIERGE plutôt que de chercher un champ non vide : un brouillon
     * dont seule la case « garder pour moi » a été cochée mérite d'être proposé, et une liste
     * de champs à surveiller finirait par en oublier un.
     */
    if (trouve !== null && JSON.stringify(trouve) !== JSON.stringify(vierge())) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBrouillonPropose(trouve);
    }

    pretAEcrire.current = true;
    // Une seule fois, au montage : rejouer la lecture écraserait ce qui est en train d'être
    // tapé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pretAEcrire.current) return;

    const instantane: BrouillonAvis = {
      gameTitle,
      steamUrl,
      entries,
      manualMode,
      manualScore,
      playtime,
      completed,
      screenshots,
      isPrivate,
      texts,
    };

    /*
     * RIEN N'EST ÉCRIT tant que le formulaire est vierge, et rien n'est effacé non plus.
     *
     * Ne pas écrire suffit à supprimer le défaut à la racine : le brouillon vide n'existe
     * jamais. Et ne pas effacer protège le brouillon en attente pendant que son sort est
     * discuté — sans quoi ouvrir la page le détruirait avant qu'on ait pu cliquer.
     */
    if (JSON.stringify(instantane) === JSON.stringify(vierge())) {
      return;
    }

    ecrireBrouillon(cleBrouillon, instantane);
  }, [
    cleBrouillon,
    vierge,
    gameTitle,
    steamUrl,
    entries,
    manualMode,
    manualScore,
    playtime,
    completed,
    screenshots,
    isPrivate,
    texts,
  ]);

  /**
   * Verse le brouillon dans le formulaire, APRÈS l'avoir remis en forme.
   *
   * Ce qui sort de `localStorage` n'est pas une valeur de confiance : il a pu être écrit par
   * une version antérieure du formulaire, tronqué, ou modifié à la main. Sans remise en
   * forme, un `entries` incomplet faisait planter la page entière — « Cannot read properties
   * of undefined » sur le premier curseur rendu. Trouvé en essayant le bouton, pas en
   * relisant le code.
   *
   * On part donc du formulaire VIERGE et on ne recouvre que ce qui a le bon type. Un champ
   * douteux est ignoré, jamais propagé : perdre une ligne d'un brouillon vaut mieux que
   * perdre la page.
   */
  function reprendreBrouillon(brut: BrouillonAvis) {
    const repris = normaliserBrouillon(brut, vierge());

    setGameTitle(repris.gameTitle);
    setSteamUrl(repris.steamUrl);
    setEntries(repris.entries);
    setManualMode(repris.manualMode);
    // Les brouillons écrits avant la correction du champ de note contiennent un nombre, ou
    // `null` là où un `NaN` a été sérialisé. On repart d'une valeur saine.
    setManualScore(repris.manualScore);
    setPlaytime(repris.playtime);
    setCompleted(repris.completed);
    setScreenshots(repris.screenshots);
    setIsPrivate(repris.isPrivate);
    setTexts(repris.texts);
    setBrouillonPropose(null);
  }

  /** Efface le brouillon pour de bon, et laisse le formulaire tel qu'il est. */
  function oublierBrouillon() {
    effacerBrouillon(cleBrouillon);
    setGameTitle(initial?.gameTitle ?? "");
    setSteamUrl(initial?.steamUrl ?? "");
    setEntries(entriesFrom(initial?.domainScores));
    setManualMode(
      initial?.overallScoreManual !== null && initial?.overallScoreManual !== undefined,
    );
    setManualScore(
      initial?.overallScoreManual !== null && initial?.overallScoreManual !== undefined
        ? String(initial.overallScoreManual)
        : "14",
    );
    setPlaytime(
      initial?.playtimeHours !== null && initial?.playtimeHours !== undefined
        ? String(initial.playtimeHours)
        : "",
    );
    setCompleted(initial?.completed ?? false);
    setScreenshots([...(initial?.screenshots ?? [])]);
    setIsPrivate(initial?.isPrivate ?? false);
    setTexts({
      whyRecommend: initial?.whyRecommend ?? "",
      whatMissed: initial?.whatMissed ?? "",
      whatHated: initial?.whatHated ?? "",
      whyNotRecommend: initial?.whyNotRecommend ?? "",
    });
    setBrouillonPropose(null);
  }

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

  /**
   * Le jeu du catalogue que le titre saisi désigne, s'il y en a un.
   *
   * La comparaison reproduit EXACTEMENT celle du serveur — `lower(trim(title))`, l'index
   * unique de la base. Deux règles de normalisation divergentes annonceraient « nouveau
   * jeu » avant de rattacher à l'existant, ou l'inverse.
   */
  const matchedGame = useMemo(
    () => existingGames.find((g) => normalise(g.title) === normalise(gameTitle)),
    [existingGames, gameTitle],
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
    setErrorRechargeable(false);

    /*
     * Contrôlé ICI, avant tout aller-retour.
     *
     * Le serveur sait désormais nommer le champ fautif, mais il ne serait même pas atteint :
     * une note illisible part comme « pas de note », et l'avis serait refusé pour une raison
     * qui n'est pas la vraie. Mieux vaut le dire tout de suite, sans attendre le réseau.
     */
    // La virgule est la façon française d'écrire une décimale, et `Number` ne la connaît
    // pas. La convertir ici plutôt que d'interdire la saisie la plus naturelle.
    const noteSaisie = manualMode ? Number(manualScore.replace(",", ".")) : null;

    if (
      manualMode &&
      (noteSaisie === null ||
        !Number.isFinite(noteSaisie) ||
        noteSaisie < 0 ||
        noteSaisie > 20 ||
        // Demi-points acceptés, tiers de point non : le produit n'affiche qu'une décimale,
        // et 16,3 donnerait un chiffre que personne n'a voulu.
        !Number.isInteger(noteSaisie * 2))
    ) {
      setError(
        "La note globale se donne entre 0 et 20, au demi-point près — 16 ou 16,5, pas 16,3.",
      );
      return;
    }

    const payload = {
      gameTitle,
      steamUrl,
      overallScoreManual: noteSaisie,
      isPrivate,
      playtimeHours: playtime.trim() === "" ? null : Number(playtime),
      completed,
      screenshots,
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
      /*
       * LE `try` EST L'AUTRE MOITIÉ DE LA CORRECTION, et c'est celle qui traite la cause.
       *
       * Une action serveur dont la requête n'aboutit pas LÈVE — elle ne rend pas un `Result`
       * en échec. C'est exactement ce qui arrive quand le conteneur redémarre pendant un
       * déploiement : l'exception remonte à la frontière d'erreur de Next, qui remplace toute
       * la page par « This page couldn't load » et son bouton « Reload ».
       *
       * Hugo ne perdait donc pas son texte à cause du rechargement : il n'avait plus que ça à
       * cliquer. Attrapé ici, le formulaire reste à l'écran, rempli, et il n'y a rien à
       * récupérer.
       *
       * Réessayer ne crée pas de doublon : si l'écriture avait abouti côté serveur avant que
       * la réponse ne se perde, `createReview` répond « avis déjà écrit » — une personne ne
       * peut avoir qu'un avis par jeu.
       */
      try {
        const result = initial
          ? await updateReviewAction(initial.reviewId, payload)
          : await createReviewAction(payload);

        if (result.ok) {
          // Publié : le brouillon n'a plus de raison d'être, et le laisser réapparaîtrait au
          // prochain avis.
          effacerBrouillon(cleBrouillon);
          router.push(`/review/${result.data.reviewId}`);
        } else {
          setError(result.message);
        }
      } catch {
        /*
         * « Réessaie » NE SUFFIT PAS, et c'était mon premier message.
         *
         * La cause la plus fréquente n'est pas une coupure passagère : c'est une page ouverte
         * AVANT un déploiement qui poste vers du code dont les identifiants d'action serveur
         * ont changé. Les journaux de production le disent mot pour mot — « Failed to find
         * Server Action […] from an older or newer deployment ». Réessayer échouera alors
         * indéfiniment : c'est la page qu'il faut recharger, pas la requête qu'il faut
         * refaire.
         *
         * Le cas s'est présenté dans le navigateur intégré de Messenger, qui garde les pages
         * en vie très longtemps sans jamais les recharger de lui-même.
         *
         * Recharger était autrefois le geste qui faisait tout perdre. Avec le brouillon, c'est
         * devenu le geste qui répare — d'où le bouton, à côté de la mention qui rassure.
         */
        setErrorRechargeable(true);
        setError(
          "L'envoi n'a pas abouti. Le plus souvent, c'est que cette page a été ouverte " +
            "avant une mise à jour du site.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-s6">
      {brouillonPropose !== null ? (
        <BrouillonDialogue
          onReprendre={() => reprendreBrouillon(brouillonPropose)}
          onOublier={oublierBrouillon}
          onFermer={() => setBrouillonPropose(null)}
        />
      ) : null}

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
          list={!editing && existingGames.length > 0 ? "jeux-existants" : undefined}
          /*
           * Le jeu ne change pas en modification : changer le jeu d'un avis, c'est écrire un
           * autre avis. La contrainte d'unicité (auteur, jeu) le refuserait de toute façon —
           * autant l'empêcher ici plutôt que d'échouer après coup.
           */
          disabled={editing}
          className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px] disabled:text-text-muted"
        />
        {/*
          Liste native plutôt qu'une recherche maison : elle marche au clavier, au doigt,
          avec un lecteur d'écran, et sur mobile le navigateur la présente comme il faut.
          Le catalogue entier est envoyé — à cinq amis il tient en quelques dizaines
          d'entrées, et une route de recherche coûterait plus cher qu'elle ne rapporte.
        */}
        {!editing && existingGames.length > 0 ? (
          <datalist id="jeux-existants">
            {existingGames.map((g) => (
              <option key={g.id} value={g.title} />
            ))}
          </datalist>
        ) : null}

        {editing ? (
          <p className="text-[11px] italic text-text-muted">
            Le jeu ne se change pas. Pour parler d&apos;un autre jeu, écris un nouvel avis.
          </p>
        ) : (
          /*
            LA réponse à « comment on lie un avis à un jeu qui en a déjà un ? » — donnée
            dans l'interface plutôt qu'expliquée ailleurs.
            Sans cette ligne, rien ne distingue « je rejoins un jeu existant » de « j'en
            crée un nouveau », et une faute de frappe dédouble le catalogue en silence.
          */
          <p
            aria-live="polite"
            className={`text-[12px] italic leading-snug ${
              matchedGame ? "text-text" : "text-text-muted"
            }`}
          >
            {gameTitle.trim() === ""
              ? "Commence à taper : les jeux déjà critiqués te seront proposés."
              : matchedGame
                ? `↳ Ton avis rejoindra ${matchedGame.reviewCount === 1 ? "l'avis existant" : `les ${matchedGame.reviewCount} avis existants`} sur « ${matchedGame.title} ».`
                : "↳ Nouveau jeu : il sera créé. Vérifie l'orthographe, elle servira à tout le monde."}
          </p>
        )}
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
                /*
                 * ENTIER, et le curseur de domaine le restera.
                 *
                 * Le demi-point ne vaut que pour la note globale personnalisée, celle qui
                 * REMPLACE le calcul. Une note de domaine est une brique du calcul : lui
                 * donner une demi-graduation ferait afficher au produit une précision que
                 * personne n'a voulue, et la base comme la validation la refusent — le
                 * curseur aurait proposé une valeur impossible à publier.
                 */
                step={1}
                // L'état vide a une apparence DISTINCTE de la valeur 0 : sans ça, un curseur
                // non touché serait indiscernable d'un « je mets zéro », et les deux ne
                // produisent pas la même note.
                data-empty={entry.state !== "rated"}
                disabled={entry.state === "notApplicable"}
                value={entry.value}
                {...gesture.touchHandlers}
                onChange={(e) => {
                  const brut = e.target.value;
                  // Passe par le crochet : un contact qui s'avère être un défilement ne
                  // doit pas déplacer la note.
                  gesture.handleChange(() => onSliderChange(domain, brut));
                }}
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
              step={0.5}
              value={manualScore}
              onChange={(e) => setManualScore(e.target.value)}
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

      <ScreenshotPicker images={screenshots} onChange={setScreenshots} />

      {/* --- Confidentialité (FR-17) --- */}
      <section className="flex flex-col gap-s3">
        <h2 className="font-display text-[15px] font-semibold">Qui peut le lire</h2>
        <label className="flex items-start gap-s3 text-[12px]">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="mt-[3px]"
          />
          <span>Garder cet avis pour moi</span>
        </label>
        {/*
          Mention PORTEUSE : elle décrit exactement ce que le réglage change, dans les deux
          sens. « Privé » sans dire ce que fait « public » laisse deviner.
        */}
        <p className="text-[12px] italic leading-snug text-text">
          {isPrivate
            ? "Personne d'autre que toi ne le verra, ni dans le fil, ni par son lien. Tu peux changer d'avis à tout moment."
            : "Il apparaîtra dans le fil, et son lien sera lisible par n'importe qui — y compris sans compte. Les passages entre || restent masqués jusqu'à ce qu'on clique dessus."}
        </p>
      </section>

      <div className="flex flex-col gap-s3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || gameTitle.trim() === "" || !hasAnyScore}
          className="rounded-[8px] border border-accent bg-accent px-s5 py-[13px] font-semibold text-on-accent disabled:opacity-50"
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
          <div aria-live="polite" className="flex flex-col gap-s2">
            <p className="text-[12px] leading-snug text-negative">{error}</p>
            {errorRechargeable ? (
              <>
                {/*
                  La MENTION D'ABORD, le bouton ensuite. Recharger a longtemps été le geste
                  qui faisait tout perdre : personne ne cliquera dessus sans être rassuré,
                  et c'est pourtant le seul qui répare quand l'action serveur a changé
                  d'identifiant sous les pieds de la page.
                */}
                <p className="text-[12px] leading-snug text-text">
                  Ton texte est gardé sur cet appareil. Recharge la page : tu le
                  retrouveras tel quel, et l’envoi repartira.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="self-start rounded-[8px] border border-accent px-s5 py-s3 text-[12px] font-semibold text-accent-text"
                >
                  Recharger la page
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Proposition de reprise d'un brouillon.
 *
 * `<dialog>` natif plutôt qu'un `div` positionné : le navigateur fournit gratuitement le
 * confinement du focus, la fermeture par Échap et l'inertie de la page derrière. Les
 * réécrire à la main, c'est trois occasions de les rater.
 *
 * LA CROIX NE DÉCIDE RIEN, et c'est exactement ce que Victor a demandé. Elle ferme, sans
 * reprendre ni effacer : quelqu'un qui n'a pas envie de trancher tout de suite garde son
 * brouillon intact. Échap fait la même chose, ce qui est la convention du navigateur.
 */
function BrouillonDialogue({
  onReprendre,
  onOublier,
  onFermer,
}: {
  readonly onReprendre: () => void;
  readonly onOublier: () => void;
  readonly onFermer: () => void;
}) {
  const boite = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // `showModal` et pas l'attribut `open` : seul l'appel rend la boîte réellement modale.
    boite.current?.showModal();
  }, []);

  return (
    <dialog
      ref={boite}
      onCancel={(e) => {
        e.preventDefault();
        onFermer();
      }}
      aria-labelledby="titre-brouillon"
      className="m-auto w-[min(420px,90vw)] rounded-[12px] border border-border bg-surface p-s5 text-text backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-s4">
        <div className="flex items-start justify-between gap-s4">
          <h2 id="titre-brouillon" className="font-display text-[17px] font-semibold">
            Il semble que tu aies un avis non publié en brouillon
          </h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer sans rien changer"
            className="shrink-0 rounded-[6px] px-s3 py-[2px] text-[16px] leading-none text-text-muted"
          >
            ×
          </button>
        </div>

        <p className="text-[12px] leading-snug text-text-muted">
          Il est gardé sur cet appareil, pas sur le site. Personne d’autre ne l’a vu.
        </p>

        <div className="flex flex-wrap gap-s3">
          <button
            type="button"
            onClick={onReprendre}
            className="rounded-[8px] bg-accent px-s5 py-s3 text-[13px] font-semibold text-on-accent"
          >
            Terminer mon avis
          </button>
          <button
            type="button"
            onClick={onOublier}
            className="rounded-[8px] border border-border px-s5 py-s3 text-[13px] text-text-muted"
          >
            Oublier mon brouillon
          </button>
        </div>
      </div>
    </dialog>
  );
}
