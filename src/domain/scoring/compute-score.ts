import { roundToOneDecimal } from "../rounding";
import {
  DOMAIN_KEYS,
  type DomainKey,
  type DomainScores,
  type ScoreOutcome,
  type Weighting,
} from "../types";

/**
 * LE moteur de notation. Implémentation UNIQUE et partagée.
 *
 * Le même appel sert deux usages qui n'ont l'air d'être qu'un : la Note globale calculée
 * d'un auteur depuis sa propre Pondération (FR-5), et la Note relue d'un lecteur depuis
 * la sienne (FR-15). C'est la même arithmétique sur des poids différents — d'où
 * l'interdiction absolue d'en écrire une seconde version. Deux implémentations, c'est la
 * garantie qu'un jour les deux surfaces afficheront deux valeurs différentes.
 *
 * TROIS MODES, et le mode fait partie du résultat :
 *
 * 1. `weighted` — au moins un Domaine noté, et la somme des poids sur ces Domaines est
 *    strictement positive.
 * 2. `simpleMean` — au moins un Domaine noté, mais la somme des poids applicables est
 *    nulle. Moyenne simple, étiquetée.
 * 3. `none` — aucun Domaine noté. Il n'existe pas de note pondérable.
 *
 * RENORMALISATION : la division par la somme des poids des seuls Domaines notés EST la
 * renormalisation. Il n'y a pas d'étape séparée. Un poids portant sur un Domaine `empty`
 * ou `notApplicable` n'entre jamais dans la somme — il n'est donc **pas compté comme un
 * zéro**, il est redistribué proportionnellement sur les autres. C'est la différence
 * entre « ce Domaine ne compte pas » et « ce Domaine vaut 0 », et elle change la note.
 *
 * AUCUNE VALIDATION DE COHÉRENCE. Un auteur peut noter l'histoire 20 et déclarer les six
 * autres Domaines sans objet : la note sort à 20/20 et elle est acceptée. On ne peut pas
 * exiger l'objectivité d'un ressenti. La comparabilité est traitée à l'affichage, en
 * annonçant l'échantillon (INV-5), pas en refusant la note.
 *
 * Fonction PURE : pas d'horloge, pas d'aléatoire, pas d'entrée/sortie. Testable à 100 %
 * sans infrastructure.
 */
export function computeScore(
  domainScores: DomainScores,
  weighting: Weighting,
): ScoreOutcome {
  // On itère sur DOMAIN_KEYS et non sur les clés de l'objet reçu : l'ordre du résultat
  // est ainsi celui du glossaire, quelle que soit la façon dont l'objet a été construit.
  const rated: { key: DomainKey; value: number }[] = [];

  for (const key of DOMAIN_KEYS) {
    const score = domainScores[key];
    // Un Domaine absent de l'objet vaut `empty`. `empty` et `notApplicable` sont écartés
    // ici, ensemble, sans être distingués — c'est le seul endroit où leur équivalence
    // arithmétique s'exprime.
    if (score?.kind === "rated") {
      rated.push({ key, value: score.value });
    }
  }

  if (rated.length === 0) {
    return { mode: "none", domainsUsed: [] };
  }

  const domainsUsed = rated.map(({ key }) => key);

  // Un poids négatif serait une donnée corrompue ; on le traite comme nul plutôt que de
  // le laisser soustraire de la somme et produire une note hors de [0, 20].
  const weightOf = (key: DomainKey) => Math.max(0, weighting[key] ?? 0);

  const totalWeight = rated.reduce((sum, { key }) => sum + weightOf(key), 0);

  if (totalWeight === 0) {
    const sum = rated.reduce((acc, { value }) => acc + value, 0);
    return {
      mode: "simpleMean",
      score: roundToOneDecimal(sum / rated.length),
      domainsUsed,
    };
  }

  const weightedSum = rated.reduce(
    (acc, { key, value }) => acc + value * weightOf(key),
    0,
  );

  return {
    mode: "weighted",
    score: roundToOneDecimal(weightedSum / totalWeight),
    domainsUsed,
  };
}
