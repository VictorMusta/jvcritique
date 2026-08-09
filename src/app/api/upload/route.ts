import { type NextRequest, NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { TAILLE_MAX_OCTETS, tailleAcceptable } from "~/server/images/bounds";
import { stockerImage } from "~/server/images/store";

/**
 * Dépôt d'un screenshot — FR-8.
 *
 * Gestionnaire de route et non action serveur (D8) : les actions passent par une couche
 * qui borne la taille du corps très bas, et y faire transiter 25 Mo reviendrait à charger
 * le fichier entier dans la charge utile d'une action. C'est l'unique exception, et elle est
 * justifiée par la contrainte.
 *
 * Le fichier est déposé AVANT que l'avis existe : l'auteur choisit ses images pendant qu'il
 * rédige. La route rend une clé, que la publication rattachera. Conséquence assumée : un
 * dépôt suivi d'un abandon laisse un fichier orphelin sur le volume. Le balayage périodique
 * est hors périmètre — à cinq amis, quelques fichiers perdus ne justifient pas une tâche
 * planifiée.
 */

const messages: Record<string, string> = {
  "trop-gros": `Cette image dépasse ${Math.round(TAILLE_MAX_OCTETS / 1024 / 1024)} Mo.`,
  "format-refuse": "Formats acceptés : JPEG, PNG et WebP.",
  "trop-de-pixels": "Cette image est bien trop grande pour être traitée.",
  illisible: "Cette image n'a pas pu être lue.",
};

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { erreur: "Il faut être connecté pour déposer une image." },
      { status: 401 },
    );
  }

  /*
   * LA TAILLE EST CONTRÔLÉE AVANT DE LIRE LE FLUX (R-D5).
   *
   * L'ordre est la protection elle-même : lire d'abord puis mesurer reviendrait à charger
   * 200 Mo en mémoire pour ensuite les refuser, ce qui EST l'attaque. Une taille absente est
   * traitée comme un refus — on ne peut pas décider sans elle.
   */
  const annonce = request.headers.get("content-length");

  if (!tailleAcceptable(annonce === null ? null : Number(annonce))) {
    return NextResponse.json(
      { erreur: messages["trop-gros"] },
      { status: 413 },
    );
  }

  let donnees: Buffer;

  try {
    const formulaire = await request.formData();
    const fichier = formulaire.get("image");

    if (!(fichier instanceof File)) {
      return NextResponse.json(
        { erreur: "Aucune image reçue." },
        { status: 400 },
      );
    }

    // Second contrôle sur la taille RÉELLE : l'en-tête annoncé est déclaratif, rien
    // n'oblige un client à dire la vérité.
    if (!tailleAcceptable(fichier.size)) {
      return NextResponse.json(
        { erreur: messages["trop-gros"] },
        { status: 413 },
      );
    }

    donnees = Buffer.from(await fichier.arrayBuffer());
  } catch {
    return NextResponse.json(
      { erreur: "Le dépôt a échoué." },
      { status: 400 },
    );
  }

  const resultat = await stockerImage(donnees);

  if (!resultat.ok) {
    return NextResponse.json(
      { erreur: messages[resultat.raison] ?? messages.illisible },
      { status: 400 },
    );
  }

  return NextResponse.json(resultat.image);
}
