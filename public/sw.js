/**
 * Service worker de jvcritiqué — délibérément SANS AUCUN CACHE.
 *
 * Il existe pour une seule raison : Chrome n'affiche l'invite d'installation que si un
 * service worker est enregistré ET qu'il possède un gestionnaire `fetch`. C'était la
 * seconde des deux raisons pour lesquelles la bannière n'apparaissait jamais.
 *
 * POURQUOI PAS SERWIST, contrairement à ce que l'architecture prévoyait : Serwist sert à
 * mettre en cache. Or INV-2 interdit tout cache applicatif, et D3 impose le recalcul à la
 * lecture — une note relue dépend de la pondération du lecteur, qui peut changer à tout
 * instant. Un service worker qui met en cache servirait des notes périmées depuis le
 * navigateur, c'est-à-dire exactement le défaut que R-D3 avait relevé sur le cache de Next,
 * mais cette fois hors de portée de toute invalidation côté serveur.
 *
 * Donc : passe-plat. Aucune réponse conservée, aucune stratégie, rien à invalider. Le jour
 * où un mode hors-ligne sera voulu, il faudra le concevoir en sachant quelles surfaces
 * peuvent mentir — ce ne sera pas un réglage, ce sera une décision.
 */

self.addEventListener("install", () => {
  // Prend la main immédiatement plutôt que d'attendre la fermeture des onglets ouverts.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  /*
   * Passe-plat explicite.
   *
   * `event.respondWith` n'est appelé que pour les navigations et les requêtes GET : pour
   * tout le reste — notamment les actions serveur, qui sont des POST — on ne s'interpose
   * pas du tout. S'interposer sans raison, c'est ajouter un endroit où une requête peut se
   * perdre.
   */
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(fetch(event.request));
});
