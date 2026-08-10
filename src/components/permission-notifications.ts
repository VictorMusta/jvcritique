"use client";

/**
 * La demande de permission, en un seul endroit.
 *
 * Deux surfaces la déclenchent — l'invitation en tête d'application et le panneau des
 * réglages. Deux implémentations auraient divergé sur le détail qui compte : la bannière
 * d'essai. Sans elle, on autorise et rien ne se passe ; on ne sait pas si ça marche, et sur un
 * téléphone c'est exactement le moment où l'on doute.
 */

export type EtatPermission = "indisponible" | "default" | "granted" | "denied";

export function etatPermission(): EtatPermission {
  return typeof Notification === "undefined"
    ? "indisponible"
    : Notification.permission;
}

export async function demanderPermission(): Promise<EtatPermission> {
  if (typeof Notification === "undefined") {
    return "indisponible";
  }

  const reponse = await Notification.requestPermission();

  if (reponse === "granted") {
    try {
      new Notification("jvcritiqué", {
        body: "C’est bon — tu seras prévenu ici.",
        tag: "jvcritique-activite",
      });
    } catch {
      // Certains navigateurs mobiles refusent le constructeur hors service worker. La
      // permission est accordée quand même, et la veille s'en servira.
    }
  }

  return reponse;
}
