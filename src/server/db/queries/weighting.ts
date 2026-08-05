import { eq } from "drizzle-orm";

import type { DomainKey, Weighting } from "~/domain/types";
import type { WeightingInput } from "~/server/validation/weighting";
import { db } from "../index";
import { weightings } from "../schema";

/**
 * FRONTIÈRE 2 — `src/server/db/queries/` est le SEUL endroit qui parle à la base. Ni une
 * page, ni une action, ni un composant n'écrit de requête.
 *
 * Ce n'est pas de la discipline pour la forme : c'est ce qui rendra le typage d'audience
 * réellement inévitable quand les spoilers arriveront. Un texte d'Avis ne pourra sortir
 * que par ici, donc il n'existera pas de chemin qui contourne le filtrage.
 */

/**
 * Pondération d'un Utilisateur, dans la forme attendue par le moteur de notation.
 *
 * Un Domaine absent du résultat signifie « pas encore réglé », ce qui fait naturellement
 * retomber `computeScore` sur la moyenne simple étiquetée — aucun cas particulier à écrire.
 */
export async function getWeighting(userId: string): Promise<Weighting> {
  const rows = await db
    .select({ domain: weightings.domain, weight: weightings.weight })
    .from(weightings)
    .where(eq(weightings.userId, userId));

  const weighting: Partial<Record<DomainKey, number>> = {};

  for (const { domain, weight } of rows) {
    weighting[domain] = weight;
  }

  return weighting;
}

/**
 * Remplace intégralement la Pondération d'un Utilisateur.
 *
 * Suppression puis insertion **dans une transaction**, plutôt qu'un enchaînement de
 * `upsert`. Deux raisons :
 *
 * 1. Un Domaine retiré du formulaire doit disparaître, pas conserver son ancienne valeur.
 *    Une suite d'`upsert` laisserait des lignes orphelines que l'utilisateur croirait
 *    supprimées.
 * 2. La transaction interdit l'état intermédiaire. Sans elle, une panne entre la
 *    suppression et l'insertion laisserait l'utilisateur sans aucune pondération — donc
 *    avec toutes ses notes relues silencieusement retombées sur la moyenne simple.
 */
export async function replaceWeighting(
  userId: string,
  entries: WeightingInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(weightings).where(eq(weightings.userId, userId));

    if (entries.length === 0) {
      return;
    }

    await tx.insert(weightings).values(
      entries.map(({ domain, weight }) => ({ userId, domain, weight })),
    );
  });
}
