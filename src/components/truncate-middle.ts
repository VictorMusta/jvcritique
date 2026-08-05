/**
 * Tronque au MILIEU, en conservant le début et la fin.
 *
 * `text-overflow: ellipsis` du CSS ne sait tronquer qu'à la fin, ce qui ne convient pas
 * ici : la spine exige que l'étiquette de propriétaire d'une note se tronque en milieu de
 * chaîne. La raison est concrète — « Alexandre-Benoît » et « Alexandre-Bertrand » tronqués
 * par la fin donnent tous deux « Alexandre-B… » et deviennent indistinguables, alors que
 * l'étiquette est justement la seule distinction NON CHROMATIQUE entre deux notes
 * (WCAG 1.4.1). Elle doit donc rester discriminante même raccourcie.
 *
 * Le nom complet reste toujours exposé au lecteur d'écran : ce qui est tronqué ici est
 * l'apparence, jamais l'information.
 */
export function truncateMiddle(text: string, maxLength: number): string {
  if (maxLength <= 1) {
    return "…";
  }

  if (text.length <= maxLength) {
    return text;
  }

  // Une position de plus au début qu'à la fin quand la place est impaire : un nom se
  // reconnaît davantage par sa tête que par sa queue.
  const keep = maxLength - 1;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;

  return `${text.slice(0, head)}…${tail > 0 ? text.slice(-tail) : ""}`;
}
