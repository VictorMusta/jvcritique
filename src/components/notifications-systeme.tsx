"use client";

import { useEffect, useState } from "react";

import {
  demanderPermission,
  etatPermission,
  type EtatPermission,
} from "./permission-notifications";

/**
 * Autorisation des notifications du système — demandée par Victor le 10 août 2026.
 *
 * ELLE NE PEUT ÊTRE DEMANDÉE QUE SUR UN GESTE, et c'est une règle des navigateurs, pas un
 * choix. Une demande au chargement de la page est refusée d'office par Chrome et Firefox, et
 * comptée contre le site. D'où le bouton : la demande part quand quelqu'un a dit qu'il la
 * voulait.
 *
 * C'EST CE RÉGLAGE QUI N'AVAIT PAS LIEU D'ÊTRE HIER. Les notifications de l'application
 * n'exigent aucune permission — elles attendent dans un onglet, et un interrupteur n'aurait
 * servi qu'à les éteindre. Celles du système dérangent vraiment : il y a une permission à
 * donner, donc un réglage à offrir. La position n'a pas changé, la fonctionnalité oui.
 *
 * LE REFUS EST DÉFINITIF DEPUIS LA PAGE, et le dire est la seule chose honnête à faire. Un
 * navigateur qui a reçu « non » ne repose plus la question : proposer un bouton qui ne fera
 * plus rien laisserait croire à une panne. On explique où se trouve le réglage à la place.
 */

export function NotificationsSysteme() {
  const [etat, setEtat] = useState<EtatPermission | "inconnu">("inconnu");

  useEffect(() => {
    // Lu au montage : `Notification` n'existe pas sur le serveur, et l'interroger pendant le
    // rendu ferait diverger les deux passages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEtat(etatPermission());
  }, []);


  return (
    <section className="panneau flex flex-col gap-s3 p-s5">
      <div className="flex flex-col gap-s2">
        <h2 className="font-display text-[15px] font-semibold">
          Notifications du système
        </h2>
        <p className="text-[11px] italic leading-snug text-text-muted">
          Une bannière de ton téléphone ou de ton ordinateur quand quelqu’un commente ou
          réagit à un de tes avis. Elle n’arrive que si jvcritiqué est ouvert — même dans un
          onglet en arrière-plan.
        </p>
      </div>

      {etat === "granted" ? (
        <p className="text-[12px] text-text">
          <span aria-hidden>✓ </span>Autorisées sur cet appareil.
        </p>
      ) : null}

      {etat === "default" ? (
        <button
          type="button"
          onClick={() => void demanderPermission().then(setEtat)}
          className="self-start rounded-[8px] bg-accent px-s5 py-s3 text-[13px] font-semibold text-on-accent"
        >
          Autoriser les notifications
        </button>
      ) : null}

      {etat === "denied" ? (
        <p className="text-[12px] leading-snug text-text-muted">
          Ton navigateur les a bloquées, et une page ne peut plus reposer la question. Pour
          les rouvrir : le cadenas à gauche de l’adresse, puis les autorisations du site.
        </p>
      ) : null}

      {etat === "indisponible" ? (
        <p className="text-[12px] leading-snug text-text-muted">
          Ce navigateur ne sait pas afficher de bannière système. L’onglet Activité et sa
          pastille fonctionnent quand même.
        </p>
      ) : null}
    </section>
  );
}
