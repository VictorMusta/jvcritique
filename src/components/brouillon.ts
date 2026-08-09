/**
 * Brouillon local d'un formulaire — conservé sur l'appareil pendant la frappe.
 *
 * Demandé par Victor le 9 août 2026 : Hugo, qui écrit beaucoup, perdait tout son texte quand
 * la publication échouait et qu'il cliquait sur « Reload ». La cause première est un
 * déploiement en cours — le conteneur redémarre pendant que l'action serveur est en vol.
 *
 * Sa demande était « que le bouton reload renvoie le même formulaire ». Un brouillon écrit
 * PENDANT la frappe couvre bien davantage pour le même travail : rechargement, onglet fermé
 * par mégarde, téléphone qui s'éteint, navigateur qui tue l'onglet en arrière-plan. Le cas du
 * rechargement n'est que le plus visible.
 *
 * SUR L'APPAREIL, et pas sur le serveur. Un brouillon serveur demanderait une table, une
 * synchronisation, une politique d'expiration et une décision sur ce qu'on fait de deux
 * appareils qui divergent. Ici, celui qui écrit récupère son texte là où il l'a tapé, ce qui
 * est le seul cas qui se présente à cinq amis.
 *
 * TOUT EST ENVELOPPÉ DANS UN `try`. `localStorage` lève pour des raisons qui n'ont rien à
 * voir avec nous : quota atteint, navigation privée sur certains navigateurs, stockage
 * désactivé par une politique. Un brouillon est un CONFORT — il ne doit jamais empêcher
 * d'écrire un avis.
 */

const PREFIXE = "jvcritique:brouillon:";

/**
 * Version du format. Une montée de version périme les brouillons existants au lieu de tenter
 * de les convertir : un brouillon a quelques heures de valeur, pas quelques mois, et du code
 * de migration pour ça coûterait plus qu'il ne rapporte.
 */
const VERSION = 1;

/**
 * Au-delà, le brouillon est ignoré.
 *
 * Retrouver son texte cinq minutes après une panne rend service. Le retrouver trois semaines
 * plus tard, alors qu'on avait renoncé, est une surprise désagréable — et sur un formulaire
 * de modification, ce serait carrément trompeur.
 */
const PEREMPTION_MS = 7 * 24 * 60 * 60 * 1000;

type Enveloppe = { v: number; le: number; donnees: unknown };

export function lireBrouillon<T>(cle: string): T | null {
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    if (brut === null) return null;

    const enveloppe = JSON.parse(brut) as Enveloppe;

    if (enveloppe.v !== VERSION || Date.now() - enveloppe.le > PEREMPTION_MS) {
      effacerBrouillon(cle);
      return null;
    }

    return enveloppe.donnees as T;
  } catch {
    // Contenu illisible : on le traite comme absent. Une donnée de confort corrompue ne
    // mérite ni message ni journal.
    return null;
  }
}

export function ecrireBrouillon(cle: string, donnees: unknown): void {
  try {
    const enveloppe: Enveloppe = { v: VERSION, le: Date.now(), donnees };
    localStorage.setItem(PREFIXE + cle, JSON.stringify(enveloppe));
  } catch {
    // Quota, navigation privée, stockage interdit. Écrire un avis reste possible.
  }
}

export function effacerBrouillon(cle: string): void {
  try {
    localStorage.removeItem(PREFIXE + cle);
  } catch {
    // Idem.
  }
}
