import { z } from "zod";

import { DOMAIN_KEYS } from "~/domain/types";

/**
 * Validation d'un Avis soumis — schémas écrits à la main (D2).
 *
 * Ces règles DOUBLENT volontairement certaines contraintes de la base. Ce n'est pas de la
 * redondance inutile : la base garantit l'état, l'application parle à l'utilisateur. Une
 * violation de `CHECK` produirait une erreur générique en français ; ici l'utilisateur
 * apprend quel champ ne va pas.
 */

/** Un champ texte facultatif : vide ou blanc devient `null`, pas une chaîne vide. */
const optionalText = z.preprocess(
  (raw) => {
    if (typeof raw !== "string") {
      return null;
    }
    const trimmed = raw.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().max(5000).nullable(),
);

/**
 * Une Note de domaine soumise. Les trois états du glossaire, et l'exclusivité vérifiée ici
 * comme en base.
 *
 * Un Domaine `empty` n'est pas représenté : il est simplement absent de la liste. C'est ce
 * qui aligne l'entrée sur le stockage et sur le moteur de notation, qui traitent tous deux
 * l'absence comme vide.
 */
export const domainScoreInputSchema = z
  .object({
    domain: z.enum(DOMAIN_KEYS),
    value: z.number().int().min(0).max(20).nullable(),
    notApplicable: z.boolean(),
  })
  .refine(
    (entry) =>
      entry.notApplicable ? entry.value === null : entry.value !== null,
    {
      message:
        "Un domaine porte soit une note, soit la marque « pas évaluable », jamais les deux ni aucune.",
    },
  );

export const reviewInputSchema = z
  .object({
    gameTitle: z.string().trim().min(1).max(255),

    /**
     * Lien Steam facultatif. Validé comme URL quand il est présent, mais son contenu n'est
     * pas interprété en V0 — l'enrichissement automatique (FR-12) est reporté.
     */
    steamUrl: z.preprocess(
      (raw) => {
        if (typeof raw !== "string") {
          return null;
        }
        const trimmed = raw.trim();
        return trimmed.length === 0 ? null : trimmed;
      },
      z.string().url().max(2048).nullable(),
    ),

    /** `null` signifie « calculée depuis les notes de domaine » (FR-5). */
    overallScoreManual: z.number().int().min(0).max(20).nullable(),

    /** Avis privé — public par défaut (FR-17). */
    isPrivate: z.boolean(),

    /** Entier, sans borne haute (FR-22). */
    playtimeHours: z.number().int().min(0).nullable(),
    completed: z.boolean(),

    whyRecommend: optionalText,
    whatMissed: optionalText,
    whatHated: optionalText,
    whyNotRecommend: optionalText,

    domainScores: z.array(domainScoreInputSchema).max(DOMAIN_KEYS.length),
  })
  .refine(
    (input) =>
      new Set(input.domainScores.map((d) => d.domain)).size ===
      input.domainScores.length,
    { message: "Un domaine ne peut apparaître qu'une fois." },
  )
  .refine(
    (input) =>
      input.overallScoreManual !== null ||
      input.domainScores.some((d) => !d.notApplicable && d.value !== null),
    {
      /**
       * LA règle croisée qui compte.
       *
       * FR-3 fait de la Note globale le seul champ obligatoire, et FR-5 autorise à la faire
       * calculer. Les deux ensemble laissent une faille : ni saisie manuelle, ni aucun
       * Domaine noté produirait un Avis SANS AUCUNE NOTE — le moteur rendrait le mode
       * `none`, et l'avis s'afficherait muet.
       *
       * Ce n'est pas une validation de cohérence sur les notes (INV-7 l'interdit) : on
       * n'exige aucune vraisemblance, seulement qu'il existe une note. Un seul domaine noté
       * 20 et le reste sans objet reste parfaitement accepté.
       */
      message:
        "Il faut au moins une note : soit la note globale à la main, soit un domaine noté.",
    },
  );

export type ReviewInput = z.infer<typeof reviewInputSchema>;
