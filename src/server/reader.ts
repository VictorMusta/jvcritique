import type { Weighting } from "~/domain/types";
import { auth } from "~/server/auth";
import { getWeighting } from "~/server/db/queries/weighting";

export type ReaderContext = {
  readonly userId: string | null;
  readonly name: string | null;
  readonly weighting: Weighting;
};

/**
 * Qui lit, et avec quels critères.
 *
 * Regroupé ici parce que chaque surface de lecture en a besoin, et qu'une note relue exige
 * les deux moitiés à la fois : le nom (INV-5 — une note porte toujours son propriétaire) et
 * la pondération. Les séparer laisserait la possibilité d'afficher une note recalculée sans
 * dire à qui elle appartient.
 *
 * Aucun cache : D3 impose le recalcul à la lecture, et une pondération modifiée doit se voir
 * immédiatement. Une moyenne pondérée de sept nombres ne coûte rien.
 */
export async function getReaderContext(): Promise<ReaderContext> {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  if (userId === null) {
    return { userId: null, name: null, weighting: {} };
  }

  return {
    userId,
    name: session?.user?.name ?? "Toi",
    weighting: await getWeighting(userId),
  };
}
