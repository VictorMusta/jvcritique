"use client";

import { useEffect, useState } from "react";

import {
  demanderPermission,
  etatPermission,
  type EtatPermission,
} from "./permission-notifications";

/**
 * Invitation à activer les notifications, en tête d'application — demandée par Victor le
 * 10 août 2026 : « faut le savoir qu'il faut aller dans les paramètres ».
 *
 * UNE INVITATION, PAS LA DEMANDE DU NAVIGATEUR. Appeler `requestPermission` au chargement est
 * la pire chose à faire : Chrome et Firefox refusent d'office une demande sans geste, et ce
 * refus est DÉFINITIF — on grillerait la seule cartouche disponible, pour toujours, sans que
 * personne n'ait rien vu passer. Ici on demande d'abord en français, et la vraie demande part
 * au clic.
 *
 * ELLE NE REVIENT PAS. Le refus est mémorisé sur l'appareil : quelqu'un qui a dit non une fois
 * n'a pas à le redire à chaque ouverture. C'est la différence entre une proposition et un
 * harcèlement.
 *
 * Elle ne s'affiche QUE si la question n'a jamais été posée au navigateur. Déjà autorisée, il
 * n'y a rien à demander ; déjà refusée, une page ne peut plus reposer la question, et insister
 * ne ferait que rappeler une impasse.
 */

const CLE_REFUS = "jvcritique:invitation-notifications-refusee";

export function InvitationNotifications() {
  const [etat, setEtat] = useState<EtatPermission | "cachee">("cachee");

  useEffect(() => {
    let refusee = false;

    try {
      refusee = localStorage.getItem(CLE_REFUS) !== null;
    } catch {
      // Stockage indisponible : on propose, quitte à reproposer. Mieux vaut une invitation de
      // trop qu'une fonctionnalité que personne ne découvre.
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEtat(refusee ? "cachee" : etatPermission());
  }, []);

  function refuser() {
    try {
      localStorage.setItem(CLE_REFUS, "1");
    } catch {
      // Sans mémoire du refus, elle reviendra. Rien de grave, et rien à en dire.
    }

    setEtat("cachee");
  }

  if (etat !== "default") {
    return null;
  }

  return (
    <div className="panneau m-s3 mb-0 flex flex-col gap-s3 border border-accent p-s4">
      <p className="text-[13px] leading-snug text-text">
        <strong className="font-semibold">Être prévenu ?</strong> Une bannière quand quelqu’un
        commente ou réagit à un de tes avis.
      </p>

      <div className="flex flex-wrap items-center gap-s3">
        <button
          type="button"
          onClick={() => void demanderPermission().then(setEtat)}
          className="rounded-[8px] bg-accent px-s5 py-s3 text-[12px] font-semibold text-on-accent"
        >
          Activer
        </button>
        <button
          type="button"
          onClick={refuser}
          className="text-[12px] text-text-muted underline decoration-dotted underline-offset-2"
        >
          Non merci
        </button>
      </div>

      {/* Dire où le retrouver : quelqu'un qui refuse aujourd'hui peut changer d'avis, et il ne
          devinera pas tout seul que c'est dans les réglages — c'est le défaut qu'on corrige. */}
      <p className="text-[11px] italic leading-snug text-text-muted">
        Tu pourras toujours l’activer plus tard depuis les réglages.
      </p>
    </div>
  );
}
