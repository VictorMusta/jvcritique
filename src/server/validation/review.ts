import { z } from "zod";

import { DOMAIN_KEYS } from "~/domain/types";

/**
 * Traduit l'echec d'une validation en une phrase qui dit QUOI CORRIGER.
 *
 * Le commentaire de ce fichier promettait depuis le debut que « l'utilisateur apprend quel
 * champ ne va pas » — mais l'action jetait le detail et n'affichait que « Il y a un souci
 * dans ce qui a ete saisi ». Signale par Victor le 9 aout 2026 : son ami Leny, brouillon
 * retrouve, restait bloque sans savoir quoi changer.
 *
 * Les phrases sont ECRITES ICI, jamais reprises de Zod : un message de bibliotheque parle de
 * types et de chemins d'objet, ce que le glossaire interdit. On rend la PREMIERE erreur et
 * non la liste : corriger un champ suffit souvent a en resoudre plusieurs, et une liste de
 * cinq reproches decourage plus qu'elle n'aide.
 */
export function expliquerEchec(erreur: z.ZodError): string {
  const premiere = erreur.issues[0];

  if (premiere === undefined) {
    return "Il y a un souci dans ce qui a été saisi.";
  }

  // Une règle croisée porte déjà sa propre phrase, écrite pour être lue.
  if (premiere.path.length === 0) {
    return premiere.message;
  }

  const champ = String(premiere.path[0]);

  const phrases: Record<string, string> = {
    gameTitle: "Il manque le nom du jeu.",
    steamUrl:
      "Le lien Steam n’est pas reconnu. Il doit commencer par « https:// » — ou laisse le champ vide.",
    playtimeHours:
      "Le temps de jeu doit être un nombre entier d’heures, sans « h » ni virgule. Écris 20, pas 20,5 ni « 20h ».",
    overallScoreManual:
      "La note globale se donne entre 0 et 20, au demi-point près — 16 ou 16,5, pas 16,3.",
    domainScores:
      "Une note de domaine ne va pas : chacune est un nombre entier entre 0 et 20, ou « pas évaluable ».",
    screenshots:
      "Une capture n’a pas fini de se déposer. Attends qu’elles soient toutes affichées, puis réessaie.",
    whyRecommend: "Le texte « pourquoi je le recommande » dépasse 5000 caractères.",
    whatMissed: "Le texte « ce qui m’a manqué » dépasse 5000 caractères.",
    whatHated: "Le texte « ce que j’ai détesté » dépasse 5000 caractères.",
    whyNotRecommend:
      "Le texte « pourquoi je ne le recommande pas » dépasse 5000 caractères.",
  };

  return phrases[champ] ?? "Il y a un souci dans ce qui a été saisi.";
}

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
        if (trimmed.length === 0) {
          return null;
        }
        /*
         * Une adresse collée depuis Steam arrive souvent SANS protocole —
         * « store.steampowered.com/app/… ». C'était un refus pur et simple, avec un message
         * qui ne disait pas pourquoi.
         *
         * On complète au lieu de refuser : l'utilisateur a fourni une information juste,
         * dans une forme que la machine n'attendait pas. `https` et pas `http` — on n'ajoute
         * pas un lien en clair au nom de la tolérance.
         */
        return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      },
      z.string().url().max(2048).nullable(),
    ),

    /**
     * `null` signifie « calculée depuis les notes de domaine » (FR-5).
     *
     * DEMI-POINTS ACCEPTÉS, entiers refusés nulle part : 16 et 16,5 sont l'un comme l'autre
     * des multiples d'un demi. Le pas est vérifié ici ET par une contrainte de la base — la
     * première parle à l'utilisateur, la seconde garantit l'état même si une correction est
     * faite à la main en SQL.
     */
    overallScoreManual: z
      .number()
      .min(0)
      .max(20)
      .refine((n) => Number.isInteger(n * 2), {
        message: "La note globale se donne au demi-point : 16 ou 16,5, pas 16,3.",
      })
      .nullable(),

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

    /**
     * Screenshots déjà déposés, désignés par leur clé de stockage (FR-8).
     *
     * Le PRD dit « aucune limite au nombre d'images par avis ». La borne de 30 n'est pas un
     * choix produit mais une protection : un tableau non borné venant du client est une
     * charge utile qu'on accepte de traiter sans savoir sa taille. Trente captures pour un
     * seul avis, personne ne le fera — la contrainte est donc invisible à l'usage.
     */
    screenshots: z
      .array(
        z.object({
          storageKey: z.string().uuid(),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        }),
      )
      .max(30),
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
