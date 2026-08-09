import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { type NextRequest } from "next/server";
import { Readable } from "node:stream";

import { cheminDe } from "~/server/images/store";

/**
 * Sert un screenshot depuis le volume — FR-8.
 *
 * SECOND gestionnaire de route, alors que D8 disait qu'il n'y en aurait qu'un. L'amendement
 * est assumé : la justification de D8 était qu'un flux de 25 Mo ne passe pas par une action
 * serveur, et servir un fichier depuis un volume tombe sous exactement la même contrainte.
 * Les fichiers écrits à l'exécution ne peuvent pas non plus vivre dans `public/`, dont le
 * contenu est figé à la construction de l'image.
 *
 * Ils pourraient être servis directement par Caddy, ce qui serait plus rapide — mais ça
 * couplerait le déploiement à une modification manuelle de la configuration partagée du
 * proxy, que INV-4 tient à distance. À l'échelle de cinq amis, le détour par Node est un
 * prix négligeable pour une dépendance en moins.
 */

/**
 * Un identifiant, jamais un chemin.
 *
 * Sans cette vérification, une clé comme `../../etc/passwd` ferait lire n'importe quel
 * fichier du conteneur. La clé étant toujours un UUID généré par nous, exiger la forme
 * exacte d'un UUID ferme la question — on ne nettoie pas le chemin, on refuse tout ce qui
 * n'est pas un identifiant.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  if (!UUID.test(key)) {
    return new Response("Introuvable", { status: 404 });
  }

  const variante =
    request.nextUrl.searchParams.get("v") === "vignette" ? "vignette" : "pleine";
  const chemin = cheminDe(key, variante);

  let infos;

  try {
    infos = await stat(chemin);
  } catch {
    return new Response("Introuvable", { status: 404 });
  }

  const flux = Readable.toWeb(
    createReadStream(chemin),
  ) as unknown as ReadableStream;

  return new Response(flux, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(infos.size),
      /*
       * Cache long et immuable, et ce n'est PAS une entorse à INV-2.
       *
       * L'invariant interdit de mettre en cache ce qui peut changer — une note relue dépend
       * de la pondération du lecteur. Un fichier image, lui, est immuable par construction :
       * sa clé est un UUID attribué à l'écriture, et modifier une image produit une nouvelle
       * clé. Il n'existe aucun état où le cache pourrait mentir.
       */
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
