"use client";

import { useEffect, useRef, useState } from "react";

import { etatNotificationsAction } from "~/server/actions/notifications";

/**
 * Surveille les notifications et fait sonner le système — demandé par Victor le 10 août 2026 :
 * l'interface ne se mettait à jour qu'au rechargement.
 *
 * TROIS DÉCISIONS QUI ÉVITENT DE DEVENIR AGAÇANT.
 *
 * 1. RIEN AU PREMIER PASSAGE. La première réponse ne sert qu'à mémoriser ce qui existait déjà.
 *    Sans ça, ouvrir l'application ferait sonner le téléphone pour une notification vieille de
 *    trois jours — et à chaque ouverture, jusqu'à ce qu'on la lise.
 *
 * 2. RIEN QUAND L'ONGLET EST CACHÉ. On n'interroge pas le serveur pour une pastille que
 *    personne ne regarde, et l'interrogation reprend IMMÉDIATEMENT au retour plutôt qu'à la
 *    fin du délai : quelqu'un qui revient veut voir l'état maintenant.
 *
 * 3. UNE SEULE NOTIFICATION SYSTÈME PAR ÉVÈNEMENT. L'identifiant de la dernière vue est
 *    conservé ; le même évènement ne peut pas sonner deux fois, même si l'interrogation
 *    repasse dessus avant qu'on l'ait lu.
 */

/** Toutes les trente secondes : assez pour « sans recharger », assez peu pour ne rien coûter. */
const PERIODE_MS = 30_000;

export function useVeilleNotifications(nonLuesInitial: number): number {
  const [nonLues, setNonLues] = useState(nonLuesInitial);

  /**
   * `null` tant qu'aucune réponse n'est arrivée — c'est ce qui distingue « on ne sait pas
   * encore » de « il n'y a rien », et qui empêche la première réponse de faire sonner.
   */
  const derniereVue = useRef<string | null>(null);

  useEffect(() => {
    let vivant = true;

    const sonner = (texte: string, reviewId: string) => {
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;

      try {
        const notification = new Notification("jvcritiqué", {
          body: texte,
          // `tag` fait REMPLACER la précédente au lieu d'empiler : trois réactions d'affilée
          // donnent une bannière à jour, pas trois bannières.
          tag: "jvcritique-activite",
        });

        notification.onclick = () => {
          window.focus();
          /*
           * Une navigation COMPLÈTE et non le routeur de Next, malgré l'avertissement du
           * linter. Ce clic vient d'une bannière du système, souvent sur un onglet en
           * arrière-plan ou une application réveillée : l'état du routeur n'y est pas
           * forcément vivant, alors qu'une adresse l'est toujours.
           */
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`/review/${reviewId}`);
        };
      } catch {
        // Certains navigateurs mobiles refusent le constructeur hors service worker. Le reste
        // — pastille et liste — continue de fonctionner, ce qui est l'essentiel.
      }
    };

    const interroger = async () => {
      if (document.visibilityState !== "visible") return;

      const etat = await etatNotificationsAction();

      if (!vivant) return;

      setNonLues(etat.nonLues);

      const id = etat.derniere?.id ?? null;

      if (derniereVue.current === null) {
        // Premier passage : on note l'état sans rien annoncer.
        derniereVue.current = id ?? "";
        return;
      }

      if (etat.derniere !== null && id !== derniereVue.current) {
        sonner(etat.derniere.texte, etat.derniere.reviewId);
      }

      derniereVue.current = id ?? "";
    };

    void interroger();

    const minuteur = setInterval(() => void interroger(), PERIODE_MS);
    const auRetour = () => void interroger();

    document.addEventListener("visibilitychange", auRetour);

    return () => {
      vivant = false;
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, []);

  return nonLues;
}
