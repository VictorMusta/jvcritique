"use client";

import { useState, useTransition } from "react";

import { reactAction } from "~/server/actions/reaction";
import { todoAction } from "~/server/actions/todo";
import type { Reaction, ReactionKind } from "~/server/db/queries/reviews";

const KINDS: ReactionKind[] = ["up", "down"];

const ICONES: Record<ReactionKind, string> = { up: "▲", down: "▼" };
const TITRES: Record<ReactionKind, string> = {
  up: "Super avis",
  down: "Avis désastreux",
};

/**
 * Réactions à un avis, et liste de jeux à faire.
 *
 * TROIS BOUTONS QUI NE FONT PLUS LA MÊME CHOSE, et c'est le point délicat de cet écran.
 * Les deux pouces jugent l'AVIS, s'excluent l'un l'autre, et sont visibles de son auteur.
 * « À faire » porte sur le JEU, est cumulable avec un pouce, et n'est visible de personne
 * d'autre. Ils se ressemblent parce qu'ils sont côte à côte, pas parce qu'ils sont de même
 * nature — d'où le séparateur qui les éloigne.
 *
 * DES COMPTEURS, ET LES NOMS AU CLIC — refonte demandée par Victor le 10 août 2026.
 *
 * La version précédente affichait les noms en clair, en permanence, sur une ligne par
 * réaction. Le raisonnement d'origine (« à cinq amis, "Paul et Marie" dit plus que 2 ») était
 * juste sur le fond et faux dans la mise en page : deux listes de noms sous chaque avis
 * prenaient plus de place que l'avis lui-même dans le fil, et se lisaient comme du contenu
 * alors que ce sont des signatures.
 *
 * Le compteur donne l'ampleur d'un coup d'œil ; les noms restent à un clic. On ne perd rien,
 * on hiérarchise.
 */
export function Reactions({
  reviewId,
  gameId,
  reactions,
  viewerId,
  isAuthor,
  dejaDansLaListe = false,
}: {
  readonly reviewId: string;
  /** La liste porte sur le JEU, pas sur l'avis qui a donné envie d'y jouer. */
  readonly gameId: string;
  readonly reactions: readonly Reaction[];
  readonly viewerId: string | null;
  readonly isAuthor: boolean;
  readonly dejaDansLaListe?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [dansLaListe, setDansLaListe] = useState(dejaDansLaListe);

  // L'état local rend le clic instantané. Le serveur reste la source de vérité : au
  // rechargement, c'est lui qui gagne. Sans ça, chaque clic attendrait un aller-retour.
  const [mine, setMine] = useState<ReactionKind | null>(
    () => reactions.find((r) => r.userId === viewerId)?.kind ?? null,
  );

  /** Quelle liste de noms est ouverte, s'il y en a une. */
  const [ouverte, setOuverte] = useState<ReactionKind | null>(null);

  const autres = reactions.filter((r) => r.userId !== viewerId);

  /**
   * Le compte inclut sa propre réaction, prise dans l'ÉTAT LOCAL et non dans les données
   * reçues du serveur : sans ça, le chiffre ne bougerait qu'au rechargement, et le bouton
   * s'allumerait à côté d'un compteur inchangé.
   */
  function compter(kind: ReactionKind): number {
    return autres.filter((r) => r.kind === kind).length + (mine === kind ? 1 : 0);
  }

  function nomsDe(kind: ReactionKind): string[] {
    const noms = autres
      .filter((r) => r.kind === kind)
      .map((r) => r.userName ?? "Quelqu'un");

    return mine === kind ? ["Toi", ...noms] : noms;
  }

  function basculerListe() {
    const avant = dansLaListe;
    setDansLaListe(!avant);

    startTransition(async () => {
      const result = await todoAction(gameId);

      if (result.ok) {
        setDansLaListe(result.data.dansLaListe);
      } else {
        setDansLaListe(avant);
      }
    });
  }

  function toggle(kind: ReactionKind) {
    const next = mine === kind ? null : kind;
    setMine(next);

    startTransition(async () => {
      const result = await reactAction(reviewId, next);

      // En cas d'échec on revient à l'état précédent : laisser un bouton allumé alors que
      // rien n'a été enregistré ferait croire à l'utilisateur qu'il a réagi.
      if (!result.ok) {
        setMine(mine);
      }
    });
  }

  return (
    <section className="flex flex-col gap-s3">
      <div className="flex flex-wrap items-center gap-s2">
        {/*
          « À FAIRE » RESTE OFFERT À L'AUTEUR, contrairement aux pouces. Se juger soi-même
          n'a pas de sens ; vouloir rejouer à un jeu dont on a parlé en a parfaitement.
        */}
        {viewerId !== null ? (
          <>
            <button
              type="button"
              onClick={basculerListe}
              disabled={pending}
              aria-pressed={dansLaListe}
              className={`flex items-center gap-s2 rounded-full border px-s4 py-s2 text-[12px] transition-colors disabled:opacity-60 ${
                dansLaListe
                  ? "border-accent bg-accent/15 font-semibold text-accent-text"
                  : "border-border text-text-muted"
              }`}
            >
              <span aria-hidden>{dansLaListe ? "✓" : "+"}</span>
              {dansLaListe ? "Dans ma liste" : "Ajouter à ma liste"}
            </button>

            {/* Séparateur : ce qui suit juge l'avis, ce qui précède ne regarde que soi. */}
            <span aria-hidden className="text-text-muted opacity-50">
              ·
            </span>
          </>
        ) : null}

        {KINDS.map((kind) => {
          const actif = mine === kind;
          const compte = compter(kind);

          /*
           * LE MÊME BOUTON NE FAIT PAS LA MÊME CHOSE selon qui regarde, et c'est cohérent
           * plutôt que capricieux : il fait la seule chose qu'il PEUT faire.
           *
           * Un lecteur peut voter, donc il vote — c'est le geste que ce pictogramme signifie
           * partout ailleurs, et le détourner surprendrait. L'auteur ne peut pas juger son
           * propre avis : pour lui le bouton ouvre la liste des noms, la seule action qui ait
           * un sens. Personne ne voit les deux comportements sur un même avis.
           */
          const votable = viewerId !== null && !isAuthor;

          return (
            <span key={kind} className="flex items-center">
              <button
                type="button"
                onClick={() =>
                  votable
                    ? toggle(kind)
                    : setOuverte(ouverte === kind ? null : kind)
                }
                disabled={pending || (!votable && compte === 0)}
                aria-pressed={votable ? actif : undefined}
                aria-expanded={votable ? undefined : ouverte === kind}
                title={votable ? TITRES[kind] : `Qui a mis « ${TITRES[kind]} »`}
                className={`flex items-center gap-s2 rounded-full border px-s4 py-s2 text-[12px] transition-colors disabled:opacity-50 ${
                  actif
                    ? "border-accent bg-accent/15 font-semibold text-accent-text"
                    : "border-border text-text-muted"
                }`}
              >
                <span aria-hidden className="text-[11px]">
                  {ICONES[kind]}
                </span>
                <span className="tnum">{compte}</span>
                <span className="sr-only">
                  {TITRES[kind]} — {compte}
                </span>
              </button>

              {/*
                Le révélateur des noms est un bouton À PART pour qui peut voter : deux gestes
                différents ne peuvent pas partager la même cible de 40 px au pouce, sinon un
                clic sur deux se trompe. Il n'apparaît que s'il y a des noms à montrer.
              */}
              {votable && compte > 0 ? (
                <button
                  type="button"
                  onClick={() => setOuverte(ouverte === kind ? null : kind)}
                  aria-expanded={ouverte === kind}
                  aria-label={`Qui a mis « ${TITRES[kind]} »`}
                  className="px-s2 text-[11px] text-text-muted"
                >
                  <span aria-hidden>{ouverte === kind ? "▾" : "▸"}</span>
                </button>
              ) : null}
            </span>
          );
        })}
      </div>

      {ouverte !== null && nomsDe(ouverte).length > 0 ? (
        <p
          aria-live="polite"
          className="text-[12px] leading-snug text-text-muted"
        >
          <span className="text-text">{TITRES[ouverte]}</span> —{" "}
          {/*
            Une énumération française, pas une liste à puces : « Paul, Marie et toi » se lit
            d'un trait, là où trois lignes à puces occuperaient autant de place que l'avis.
          */}
          {enumerer(nomsDe(ouverte))}
        </p>
      ) : null}
    </section>
  );
}

/** « Paul », « Paul et Marie », « Paul, Marie et toi ». */
function enumerer(noms: readonly string[]): string {
  if (noms.length <= 1) {
    return noms[0] ?? "";
  }

  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}
