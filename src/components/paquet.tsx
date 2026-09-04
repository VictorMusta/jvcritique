"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent as PointerEventReact,
  type ReactNode,
} from "react";

import {
  gestePourTouche,
  LIBELLES_GESTE,
  resoudreGeste,
  SEUIL_GESTE,
  type Geste,
} from "~/domain/paquet/geste";
import type { Weighting } from "~/domain/types";
import { traiterCarteAction } from "~/server/actions/paquet";
import type { ReviewForDisplay } from "~/server/db/queries/reviews";
import { ReviewCard } from "./review-card";

/*
 * LE PAQUET.
 *
 * Quand il reste des avis non vus, le Fil s'ouvre là-dessus : une carte à la fois, les
 * suivantes derrière, quatre gestes pour passer à la suivante. Le paquet vidé, un bilan, puis
 * le fil. « Fermer » rend la main au fil à tout moment, sans rien marquer.
 *
 * Décidé le 3 septembre 2026 après trois séries de maquettes. Ce n'est PAS un onglet : un
 * paquet vide serait un onglet mort la plupart du temps. C'est le Fil qui commence par ce
 * qu'on n'a pas encore vu.
 *
 * Trois règles qui expliquent la forme du code :
 *
 * 1. LE PAQUET EST FIGÉ À L'OUVERTURE. Les cartes sont copiées dans un état au montage et les
 *    mises à jour du parent sont ignorées. Côté serveur, un avis marqué vu sort de la liste
 *    des non-vus ; si le composant suivait cette liste, chaque geste décalerait les cartes
 *    sous le pouce, et le bilan n'aurait jamais lieu.
 *
 * 2. LES BOUTONS SONT LE CHEMIN ACCESSIBLE, le balayage n'est qu'une commodité posée dessus.
 *    Un glissement du doigt n'est ni annoncé ni atteignable au clavier ; les quatre boutons
 *    portent chacun un libellé, et les flèches du clavier les doublent sur PC.
 *
 * 3. RIEN NE SE PASSE PENDANT L'ANIMATION DE SORTIE. Tant qu'une carte s'en va, un second
 *    geste est ignoré : sinon deux gestes rapprochés s'appliqueraient à la même carte.
 */

type Compte = Readonly<Record<Geste, number>>;
type Mode = "paquet" | "bilan" | "fil";

const COMPTE_VIDE: Compte = { aime: 0, pas_pour_moi: 0, souhait: 0, passer: 0 };
/** L'ordre des boutons à l'écran : celui des flèches, gauche → bas → haut → droite. */
const ORDRE_BOUTONS: readonly Geste[] = ["pas_pour_moi", "passer", "souhait", "aime"];
const DUREE_SORTIE_MS = 220;
const DELAI_BILAN_MS = 3000;
/** Au-delà de ce déplacement, un relâchement n'est plus un clic sur la carte. */
const TOLERANCE_CLIC_PX = 6;

const ICONES: Readonly<Record<Geste | "croix", string>> = {
  pas_pour_moi: "M18 6L6 18M6 6l12 12",
  passer: "M6 9l6 6 6-6",
  souhait: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  aime: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z",
  croix: "M18 6L6 18M6 6l12 12",
};

function Icone({ nom, taille = 22 }: { readonly nom: Geste | "croix"; readonly taille?: number }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICONES[nom]} />
    </svg>
  );
}

/** Où la carte part quand un geste est confirmé : assez loin pour sortir de l'écran. */
function transformDeSortie(geste: Geste): string {
  switch (geste) {
    case "aime":
      return "translate(560px, 0) rotate(20deg)";
    case "pas_pour_moi":
      return "translate(-560px, 0) rotate(-20deg)";
    case "souhait":
      return "translate(0, -720px)";
    case "passer":
      return "translate(0, 720px)";
  }
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

function Bilan({
  compte,
  total,
  surVoirLeFil,
}: {
  readonly compte: Compte;
  readonly total: number;
  readonly surVoirLeFil: () => void;
}) {
  const parts: string[] = [];
  if (compte.aime > 0) parts.push(pluriel(compte.aime, "aimé"));
  if (compte.souhait > 0) parts.push(`${compte.souhait} à souhaiter`);
  if (compte.pas_pour_moi > 0) parts.push(`${compte.pas_pour_moi} pas pour toi`);
  if (compte.passer > 0) parts.push(pluriel(compte.passer, "passé"));

  return (
    <section
      aria-live="polite"
      className="orne relative mx-auto flex w-full max-w-[520px] flex-col items-center gap-s4 rounded-md bg-surface p-s6 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-positive text-on-accent">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <h2 className="font-display text-[24px] font-semibold leading-tight">Tout est vu.</h2>
      <p className="text-[13px] leading-relaxed text-text-muted">
        {/* « avis » est invariable : pas de pluriel automatique ici. */}
        {total} avis {total > 1 ? "parcourus" : "parcouru"}
        {parts.length > 0 ? ` : ${parts.join(", ")}.` : "."}
      </p>
      <button
        type="button"
        onClick={surVoirLeFil}
        className="mt-s2 flex min-h-[44px] w-full items-center justify-center gap-s2 rounded-full bg-accent px-s5 text-[13px] font-semibold text-on-accent"
      >
        Voir le fil <span aria-hidden>→</span>
      </button>
      <p className="text-[11px] text-text-muted">Le fil s’affiche tout seul dans quelques secondes.</p>
    </section>
  );
}

export function Paquet({
  cartes: cartesInitiales,
  readerName,
  readerId,
  readerWeighting,
  children,
}: {
  readonly cartes: readonly ReviewForDisplay[];
  readonly readerName: string | null;
  readonly readerId: string;
  readonly readerWeighting: Weighting;
  /** Le fil, rendu par le serveur, qu'on affiche quand le paquet rend la main. */
  readonly children: ReactNode;
}) {
  const router = useRouter();
  // Règle 1 : figé à l'ouverture. `useState` n'évalue son initialisateur qu'une fois.
  const [cartes] = useState(() => [...cartesInitiales]);
  const [index, setIndex] = useState(0);
  // Rien à voir à l'ouverture : le fil, tout de suite. Décidé ICI et une fois, parce que le
  // parent rend ce composant même sans cartes — voir FilOuPaquet, dans la page.
  const [mode, setMode] = useState<Mode>(() => (cartesInitiales.length > 0 ? "paquet" : "fil"));
  const [compte, setCompte] = useState<Compte>(COMPTE_VIDE);
  const [deplacement, setDeplacement] = useState({ dx: 0, dy: 0 });
  const [enMain, setEnMain] = useState(false);
  const [sortie, setSortie] = useState<Geste | null>(null);
  const [, startTransition] = useTransition();

  const origine = useRef<{ x: number; y: number } | null>(null);
  const aBouge = useRef(false);
  const mouvementReduit = useRef(false);

  useEffect(() => {
    mouvementReduit.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const total = cartes.length;
  const courante = cartes[index];
  const suivante = cartes[index + 1];

  /*
   * Rendre la main au fil. `router.refresh()` redemande la page au serveur : les réactions
   * données dans le paquet apparaissent sur les cartes du fil, et les avis marqués vus ne
   * sont plus des non-vus. L'état de ce composant survit au rafraîchissement (même position
   * dans l'arbre), donc on ne retombe pas dans le paquet quand il reste des cartes après
   * « Fermer ».
   */
  const rendreLaMain = useCallback(() => {
    setMode("fil");
    router.refresh();
  }, [router]);

  const appliquer = useCallback(
    (geste: Geste) => {
      const carte = cartes[index];
      if (!carte) {
        return;
      }
      startTransition(async () => {
        // Un échec ici n'est pas montré : au pire, l'avis n'est pas marqué et reviendra dans
        // le prochain paquet, où un geste le marquera.
        await traiterCarteAction(carte.id, geste);
      });
      setCompte((c) => ({ ...c, [geste]: c[geste] + 1 }));
      setSortie(null);
      setDeplacement({ dx: 0, dy: 0 });
      if (index + 1 >= total) {
        setMode("bilan");
      } else {
        setIndex(index + 1);
      }
    },
    [cartes, index, total],
  );

  const lancer = useCallback(
    (geste: Geste) => {
      // Règle 3 : rien pendant la sortie.
      if (sortie !== null || mode !== "paquet") {
        return;
      }
      if (mouvementReduit.current) {
        appliquer(geste);
        return;
      }
      setSortie(geste);
      window.setTimeout(() => appliquer(geste), DUREE_SORTIE_MS);
    },
    [appliquer, mode, sortie],
  );

  // Le clavier, sur PC : les flèches doublent les quatre boutons, Entrée ouvre, Échap ferme.
  useEffect(() => {
    if (mode !== "paquet") {
      return;
    }
    const surTouche = (evenement: KeyboardEvent) => {
      const cible = evenement.target;
      if (
        cible instanceof HTMLElement &&
        cible.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (evenement.key === "Escape") {
        evenement.preventDefault();
        rendreLaMain();
        return;
      }
      if (evenement.key === "Enter" && courante) {
        evenement.preventDefault();
        router.push(`/review/${courante.id}`);
        return;
      }
      const geste = gestePourTouche(evenement.key);
      if (geste !== null) {
        evenement.preventDefault();
        lancer(geste);
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [courante, lancer, mode, rendreLaMain, router]);

  // Le bilan ne retient pas la personne : le fil arrive tout seul.
  useEffect(() => {
    if (mode !== "bilan") {
      return;
    }
    const minuteur = window.setTimeout(rendreLaMain, DELAI_BILAN_MS);
    return () => window.clearTimeout(minuteur);
  }, [mode, rendreLaMain]);

  const surPointerDown = (evenement: PointerEventReact<HTMLDivElement>) => {
    if (evenement.button !== 0 || sortie !== null) {
      return;
    }
    // Un lien ou un bouton DANS la carte reste un lien ou un bouton : on ne le confisque pas.
    const cible = evenement.target;
    if (cible instanceof Element && cible.closest("a, button")) {
      return;
    }
    origine.current = { x: evenement.clientX, y: evenement.clientY };
    aBouge.current = false;
    setEnMain(true);
    evenement.currentTarget.setPointerCapture(evenement.pointerId);
  };

  /*
   * AU DOIGT, SEUL L'HORIZONTAL EST UN GESTE. Un avis est plus haut qu'un écran de téléphone :
   * le mouvement vertical, c'est le défilement, et il appartient au navigateur (`touch-pan-y`
   * sur la carte). La première version confisquait tout — impossible de descendre jusqu'aux
   * boutons, et un défilement un peu long devenait un « passer » involontaire. Le haut et le
   * bas restent accessibles par les boutons et les flèches du clavier.
   */
  const surPointerMove = (evenement: PointerEventReact<HTMLDivElement>) => {
    if (origine.current === null) {
      return;
    }
    const dx = evenement.clientX - origine.current.x;
    if (Math.abs(dx) > TOLERANCE_CLIC_PX) {
      aBouge.current = true;
    }
    setDeplacement({ dx, dy: 0 });
  };

  const surPointerUp = (evenement: PointerEventReact<HTMLDivElement>) => {
    if (origine.current === null) {
      return;
    }
    const dx = evenement.clientX - origine.current.x;
    origine.current = null;
    setEnMain(false);
    const geste = resoudreGeste(dx, 0);
    if (geste !== null) {
      lancer(geste);
    } else {
      setDeplacement({ dx: 0, dy: 0 });
    }
  };

  // Le navigateur a pris la main (il fait défiler) : ce n'était pas un geste, on remet la carte.
  const surPointerCancel = () => {
    origine.current = null;
    aBouge.current = false;
    setEnMain(false);
    setDeplacement({ dx: 0, dy: 0 });
  };

  if (mode === "fil") {
    return <>{children}</>;
  }
  if (mode === "bilan") {
    return <Bilan compte={compte} total={total} surVoirLeFil={rendreLaMain} />;
  }
  if (!courante) {
    return <>{children}</>;
  }

  // Le tampon : celui du geste confirmé, sinon celui que le déplacement annonce déjà.
  const tampon =
    sortie ?? (enMain ? resoudreGeste(deplacement.dx, deplacement.dy, SEUIL_GESTE / 2) : null);
  const transform =
    sortie !== null
      ? transformDeSortie(sortie)
      : enMain
        ? `translate(${deplacement.dx}px, ${deplacement.dy}px) rotate(${deplacement.dx / 18}deg)`
        : "none";
  const transition = sortie !== null ? `transform ${DUREE_SORTIE_MS}ms ease-in, opacity ${DUREE_SORTIE_MS}ms` : enMain ? "none" : "transform 160ms ease-out";
  const restants = total - index;
  const auteurs = [...new Set(cartes.slice(index).map((c) => c.author.name ?? "Quelqu’un"))];

  return (
    /*
     * `pb-28` : la place de la barre de boutons, fixée au bas de l'écran. Sans cette marge,
     * le bas de la carte — le lien « Lire l'avis en entier » — passerait dessous.
     */
    <section aria-label="Avis non vus" className="mx-auto flex w-full max-w-[520px] flex-col gap-s4 pb-28">
      {/* L'en-tête reste collé en haut pendant qu'on fait défiler une longue carte : le compte
          et « Fermer » ne sont jamais hors de portée. */}
      <header className="sticky top-0 z-10 -mx-s5 -mt-s5 flex items-start justify-between gap-s3 bg-bg/95 px-s5 pt-s5 pb-s3 backdrop-blur">
        <div className="flex flex-col gap-[2px]">
          <p className="text-[13px] font-bold">{pluriel(restants, "avis non vu")}</p>
          <p className="text-[11px] text-text-muted">
            par {auteurs.slice(0, 3).join(", ")}
            {auteurs.length > 3 ? ` et ${auteurs.length - 3} autre${auteurs.length - 3 > 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={rendreLaMain}
          className="flex min-h-[36px] shrink-0 items-center gap-s2 rounded-full border border-accent px-s4 text-[12px] font-semibold text-accent-text"
        >
          Fermer <Icone nom="croix" taille={14} />
        </button>
      </header>

      <div
        className="flex items-center gap-s3"
        role="progressbar"
        aria-label="Avancement du paquet"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index}
      >
        <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-surface-raised">
          <span className="block h-full bg-accent" style={{ width: `${(index / total) * 100}%` }} />
        </span>
        <span className="tnum text-[12px] font-semibold">
          {index} / {total}
        </span>
      </div>

      <div className="relative">
        {suivante ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 origin-bottom scale-[.97] overflow-hidden opacity-80">
            <ReviewCard
              review={suivante}
              readerName={readerName}
              readerId={readerId}
              readerWeighting={readerWeighting}
            />
          </div>
        ) : null}

        {/*
          `touch-pan-y` : le doigt qui monte ou descend fait DÉFILER, comme partout ; seul un
          mouvement horizontal nous parvient comme un geste. C'est ce qui rend une longue
          carte lisible jusqu'au bout sur téléphone.
        */}
        <div
          className="relative touch-pan-y"
          style={{ transform, transition, opacity: sortie !== null ? 0.6 : 1 }}
          onPointerDown={surPointerDown}
          onPointerMove={surPointerMove}
          onPointerUp={surPointerUp}
          onPointerCancel={surPointerCancel}
          onClickCapture={(evenement) => {
            // Un glissement qui finit sur la carte ne doit pas l'ouvrir. La carte lit
            // `defaultPrevented` avant de naviguer : c'est le contrat de CarteCliquable.
            if (aBouge.current) {
              evenement.preventDefault();
              evenement.stopPropagation();
              aBouge.current = false;
            }
          }}
        >
          {tampon !== null ? (
            <div
              aria-hidden
              className={`pointer-events-none absolute top-[22px] z-10 rounded-[8px] border-[3px] bg-surface px-s4 py-s2 text-[22px] font-extrabold tracking-[.04em] ${
                tampon === "aime"
                  ? "left-[18px] -rotate-12 border-positive text-positive"
                  : tampon === "pas_pour_moi"
                    ? "right-[18px] rotate-12 border-negative text-negative"
                    : tampon === "souhait"
                      ? "left-1/2 -translate-x-1/2 border-accent text-accent-text"
                      : "left-1/2 -translate-x-1/2 border-border text-text-muted"
              }`}
            >
              {LIBELLES_GESTE[tampon].tampon}
            </div>
          ) : null}
          <ReviewCard
            review={courante}
            readerName={readerName}
            readerId={readerId}
            readerWeighting={readerWeighting}
          />
        </div>
      </div>

      {/*
        Règle 2 : les boutons sont le chemin accessible. Quatre, dans l'ordre des flèches du
        clavier — gauche, bas, haut, droite — pour que la main et l'œil apprennent la même chose.
        Le fond fait partie du style de chaque bouton : deux classes de fond sur le même élément
        se disputent, et c'est le blanc qui gagnait — le cœur, clair, disparaissait dessus.

        LA BARRE EST FIXÉE AU BAS DE L'ÉCRAN, juste au-dessus de la navigation (qui occupe les
        80 px que la mise en page lui réserve). Posés sous la carte, les boutons partaient
        hors écran dès que l'avis dépassait la hauteur du téléphone — Victor les a vus
        « disparaître ». Ici, ils ne bougent pas, quelle que soit la longueur de l'avis.
      */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-s2 border-t border-border/40 bg-bg/95 px-s4 pt-s3 pb-[62px] backdrop-blur">
        <p className="hidden text-center text-[11px] text-text-muted sm:block">
          ← pas pour moi · ↓ passer · ↑ à souhaiter · → j’aime · Entrée pour lire · Échap pour fermer
        </p>
        <div className="flex justify-center gap-s4">
        {ORDRE_BOUTONS.map((geste) => {
          const style =
            geste === "aime"
              ? "border-positive bg-positive text-on-accent"
              : geste === "pas_pour_moi"
                ? "border-negative bg-surface text-negative"
                : geste === "passer"
                  ? "border-border bg-surface text-text-muted"
                  : "border-accent bg-surface text-accent-text";
          return (
            <button
              key={geste}
              type="button"
              aria-label={LIBELLES_GESTE[geste].bouton}
              title={LIBELLES_GESTE[geste].bouton}
              onClick={() => lancer(geste)}
              disabled={sortie !== null}
              className={`flex h-14 w-14 items-center justify-center rounded-full border ${style}`}
            >
              <Icone nom={geste} />
            </button>
          );
        })}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Avis {index + 1} sur {total} : {courante.game.title}, par {courante.author.name ?? "quelqu’un"}.
      </p>
    </section>
  );
}
