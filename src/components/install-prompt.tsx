"use client";

import { useEffect, useState } from "react";

/**
 * Bouton d'installation de la PWA.
 *
 * Chrome n'ouvre plus d'invite spontanée : il émet `beforeinstallprompt` et laisse le site
 * décider quand la proposer. Sans ce composant, l'application est installable mais rien ne
 * le dit — il faut aller chercher « Ajouter à l'écran d'accueil » dans le menu du
 * navigateur, ce que personne ne fait.
 *
 * Le bouton n'apparaît QUE si le navigateur a confirmé que l'installation est possible.
 * Afficher un bouton qui pourrait ne rien faire serait pire que ne rien afficher.
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    // Le service worker n'a aucun rôle fonctionnel ici (il ne met rien en cache) : il est
    // enregistré parce que sa présence est une CONDITION de l'invite d'installation.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Un échec d'enregistrement ne casse rien : l'application fonctionne à
        // l'identique, elle n'est simplement pas installable. Pas de bruit à l'écran.
      });
    }

    const onPrompt = (e: Event) => {
      // Empêche l'ancienne mini-barre de Chrome, pour proposer l'installation à notre
      // moment plutôt qu'au sien.
      e.preventDefault();
      setEvent(e as InstallEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setEvent(null));

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (event === null) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          await event.prompt();
          await event.userChoice;
          // L'événement n'est utilisable qu'une fois : le garder afficherait un bouton
          // devenu inopérant.
          setEvent(null);
        })();
      }}
      className="rounded-[8px] border border-accent px-s4 py-s2 text-[11px] font-semibold text-accent-text"
    >
      Installer l&apos;app
    </button>
  );
}
