import { z } from "zod";

import { DOMAIN_KEYS, type DomainKey, type Weighting } from "~/domain/types";

/**
 * Validation de la Pondération soumise — schéma écrit à la main (D2), sans `drizzle-zod`.
 *
 * Isolé dans son propre module, et non dans le fichier d'action, pour une raison
 * pratique : un fichier `"use server"` importe la session et le cache de Next, ce qui le
 * rend intestable sans monter un environnement complet. Ici, la validation se teste en
 * quelques millisecondes.
 *
 * La forme d'entrée est une LISTE de couples, et non un objet à sept clés. Elle épouse la
 * forme du stockage — une ligne par Domaine pondéré — ce qui évite une conversion entre le
 * bord de l'application et la base, donc un endroit où se tromper.
 */
export const weightingInputSchema = z
  .array(
    z.object({
      domain: z.enum(DOMAIN_KEYS),
      // L'importance va de 0 à 100 (FR-2). La borne est aussi portée par la base : ici on
      // parle à l'utilisateur, là-bas on garantit l'état.
      weight: z.number().int().min(0).max(100),
    }),
  )
  .max(DOMAIN_KEYS.length)
  .refine(
    (entries) => new Set(entries.map((e) => e.domain)).size === entries.length,
    // Sans cette vérification, deux valeurs pour le même Domaine passeraient la validation
    // et la dernière écraserait silencieusement la première.
    { message: "Un domaine ne peut apparaître qu'une fois." },
  );

export type WeightingInput = z.infer<typeof weightingInputSchema>;

/** Convertit la liste validée vers la forme attendue par le moteur de notation. */
export function toWeighting(entries: WeightingInput): Weighting {
  const weighting: Partial<Record<DomainKey, number>> = {};

  for (const { domain, weight } of entries) {
    weighting[domain] = weight;
  }

  return weighting;
}
