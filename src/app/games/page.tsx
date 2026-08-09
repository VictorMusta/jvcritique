import Link from "next/link";

import { listGames } from "~/server/db/queries/games";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const games = await listGames();

  return (
    <main className="flex flex-col gap-s4 p-s3">
      <div className="panneau flex flex-col gap-s5 p-s5">
      <h1 className="font-display text-[25px] font-semibold leading-tight">
        Les jeux
      </h1>

      {games.length === 0 ? (
        <p className="text-[12px] text-text-muted">
          Le catalogue se remplit tout seul : un jeu apparaît ici dès que quelqu&apos;un
          poste un avis dessus.
        </p>
      ) : (
        <ul className="flex flex-col gap-s2">
          {games.map((game) => (
            <li key={game.id}>
              <Link
                href={`/game/${game.id}`}
                className="block rounded-[8px] border border-border bg-surface px-s4 py-s3 font-display text-[15px] hover:border-accent"
              >
                {game.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      </div>
    </main>
  );
}
