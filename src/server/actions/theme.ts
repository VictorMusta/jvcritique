"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { themeValide } from "~/domain/themes";
import { guard, ok, type Result } from "~/server/result";

/**
 * Enregistre la variante de couleurs choisie — FR-20.
 *
 * Dans un COOKIE et non en base, alors que la pondération, elle, y est stockée. La
 * différence n'est pas arbitraire : une pondération change les notes affichées et doit
 * suivre l'utilisateur d'un appareil à l'autre. Un thème ne change rien au contenu, et se
 * choisit volontiers différemment sur téléphone et sur ordinateur.
 *
 * Conséquence assumée : le choix ne suit pas un changement de navigateur. C'est le
 * comportement attendu, pas une limitation.
 *
 * Aucune session n'est requise. Un visiteur sans compte peut lire les avis publics, donc il
 * peut aussi choisir comment les lire — exiger une connexion pour changer une couleur serait
 * gratuit.
 */
export async function setThemeAction(id: unknown): Promise<Result<null>> {
  return guard(async () => {
    // La validation retombe silencieusement sur le défaut : un thème inconnu n'est pas une
    // erreur à signaler, juste un choix qui n'existe plus.
    const theme = themeValide(typeof id === "string" ? id : null);

    const jar = await cookies();

    jar.set("theme", theme, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      // Pas de `httpOnly` : aucune valeur sensible ici, et le laisser lisible permettra un
      // jour d'éviter le clignotement au chargement sans aller-retour serveur.
      httpOnly: false,
    });

    /*
     * Toutes les routes portent la couleur, donc toutes sont concernées. `layout` cible la
     * mise en page racine plutôt que chaque page une par une — sans ça, il faudrait penser
     * à ajouter chaque nouvelle route ici, et on l'oublierait.
     */
    revalidatePath("/", "layout");

    return ok(null);
  });
}
