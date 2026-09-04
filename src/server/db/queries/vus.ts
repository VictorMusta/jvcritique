import { eq } from "drizzle-orm";

import { db } from "../index";
import { reviewVus } from "../schema";

/**
 * Pose la marque « vu » d'une personne sur un avis.
 *
 * IDEMPOTENT par construction : la clé primaire refuse le doublon, et `onConflictDoNothing`
 * fait de la seconde pose un non-événement au lieu d'une erreur. C'est nécessaire — la marque
 * est posée par quatre gestes différents et par l'ouverture de la page, et rien n'empêche
 * deux de ces chemins de se croiser pour le même avis.
 */
export async function marquerVu(userId: string, reviewId: string): Promise<void> {
  await db.insert(reviewVus).values({ userId, reviewId }).onConflictDoNothing();
}

/**
 * Les identifiants des avis qu'une personne a déjà vus.
 *
 * Deux requêtes plutôt qu'un `NOT EXISTS` corrélé : la liste reste courte (quelques dizaines
 * pour cinq amis qui publient quelques avis par semaine), et une exclusion par liste se lit
 * — et se déboguera — bien plus simplement qu'une sous-requête corrélée dans le constructeur
 * relationnel de Drizzle.
 */
export async function idsVusPar(userId: string): Promise<string[]> {
  const rows = await db
    .select({ reviewId: reviewVus.reviewId })
    .from(reviewVus)
    .where(eq(reviewVus.userId, userId));
  return rows.map((r) => r.reviewId);
}
