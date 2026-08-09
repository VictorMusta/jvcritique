import { and, eq, inArray } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { accounts } from "~/server/db/schema";

/**
 * Qui est administrateur — D4.
 *
 * La liste vit dans une VARIABLE D'ENVIRONNEMENT, pas en base. Conséquence directe :
 * personne ne peut se promouvoir administrateur depuis l'application, même en exploitant une
 * faille d'écriture, parce que la source de vérité n'est pas dans la base qu'on écrit. La
 * changer exige un accès au serveur et un redémarrage.
 *
 * Pas de table de rôles non plus, pas d'écran de gestion des droits : à cinq amis, ce serait
 * de la machinerie pour un seul administrateur qui ne changera jamais.
 */

/** Identifiants Discord déclarés administrateurs. Vide si la variable est absente. */
function adminDiscordIds(): string[] {
  return (env.ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    // Filtre les entrées vides : une variable à `"a,,b"` ou finissant par une virgule ne
    // doit pas produire un identifiant vide qui pourrait correspondre par accident.
    .filter((id) => id.length > 0);
}

/**
 * Vrai si l'Utilisateur est administrateur.
 *
 * Traduit l'identifiant interne du compte en identifiant Discord via la table des comptes
 * liés, puis compare à la liste. Ce détour est nécessaire : `users.id` est un UUID généré
 * par l'application, sans rapport avec Discord.
 *
 * Rend `false` pour un visiteur non connecté, sans interroger la base.
 */
export async function isAdmin(userId: string | null): Promise<boolean> {
  const ids = adminDiscordIds();

  if (userId === null || ids.length === 0) {
    return false;
  }

  const found = await db
    .select({ id: accounts.providerAccountId })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "discord"),
        // La comparaison se fait EN BASE plutôt qu'en mémoire : inutile de rapatrier les
        // comptes liés d'un utilisateur pour les filtrer ensuite.
        inArray(accounts.providerAccountId, ids),
      ),
    )
    .limit(1);

  return found.length > 0;
}
