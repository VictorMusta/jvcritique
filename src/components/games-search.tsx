"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * Liste des jeux avec un champ de recherche — demandé par Victor le 9 août 2026.
 *
 * FILTRAGE CÔTÉ CLIENT, et c'est le bon choix ici plutôt qu'une facilité.
 *
 * Le catalogue se remplit d'un jeu par avis publié : à cinq amis, il compte des dizaines
 * d'entrées, pas des milliers. Elles sont déjà toutes dans la page. Interroger le serveur à
 * chaque frappe ajouterait un aller-retour, un état de chargement et une gestion de course
 * entre réponses — pour un résultat plus lent que de filtrer un tableau déjà présent.
 *
 * Le jour où le catalogue deviendrait trop gros pour tenir dans une page, ce n'est pas la
 * recherche qu'il faudrait changer d'abord, c'est la liste elle-même.
 */

/**
 * Rend une chaîne comparable : sans accents, sans casse.
 *
 * Sans ça, chercher « pokemon » ne trouverait pas « Pokémon », et « zelda » raterait un titre
 * saisi avec une majuscule accentuée. C'est le défaut le plus courant d'une recherche en
 * français, et il fait conclure que le jeu n'est pas dans le catalogue — donc republier un
 * doublon.
 */
export function comparable(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function GamesSearch({
  games,
}: {
  readonly games: readonly { id: string; title: string; nbAvis: number }[];
}) {
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(() => {
    const terme = comparable(recherche.trim());
    if (terme === "") return games;

    return games.filter((game) => comparable(game.title).includes(terme));
  }, [games, recherche]);

  return (
    <>
      {/*
        * Le champ n'apparaît qu'à partir de six jeux.
        *
        * Chercher parmi quatre entrées toutes visibles à l'écran n'aide personne : ça ajoute
        * un élément à lire avant d'atteindre ce qu'on regardait déjà.
        */}
      {games.length >= 6 ? (
        <div className="flex flex-col gap-s2">
          <label htmlFor="recherche" className="sr-only">
            Chercher un jeu
          </label>
          <input
            id="recherche"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un jeu…"
            className="rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 text-[13px]"
          />
        </div>
      ) : null}

      {filtres.length === 0 ? (
        /*
         * Un résultat vide n'est pas une erreur, et il ne doit pas se lire comme telle : le
         * jeu n'a simplement pas encore d'avis. On dit donc quoi faire, pas ce qui a raté.
         */
        <p className="text-[12px] leading-snug text-text-muted">
          Aucun jeu ne porte ce nom pour l’instant. Il entrera au catalogue dès que
          quelqu’un publiera un avis dessus.
        </p>
      ) : (
        <ul className="flex flex-col gap-s2">
          {filtres.map((game) => (
            <li key={game.id}>
              <Link
                href={`/game/${game.id}`}
                className="flex items-baseline justify-between gap-s4 rounded-[8px] border border-border bg-surface-raised px-s4 py-s3 hover:border-accent"
              >
                <span className="font-display text-[15px]">{game.title}</span>
                {/* Le nombre d'avis, demandé par Victor : c'est ce qui distingue un jeu dont
                    le groupe a débattu d'un jeu que personne n'a repris. */}
                <span className="tnum shrink-0 text-[11px] text-text-muted">
                  {game.nbAvis} {game.nbAvis === 1 ? "avis" : "avis"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
