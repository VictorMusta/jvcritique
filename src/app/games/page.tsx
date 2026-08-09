import { GamesSearch } from "~/components/games-search";
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
          /*
           * Seuls l'identifiant et le titre traversent la frontière serveur/client : c'est
           * tout ce que la liste affiche. Passer l'objet entier enverrait au navigateur des
           * champs dont il n'a que faire, et qu'on oublierait de retirer plus tard.
           */
          <GamesSearch
            games={games.map((game) => ({ id: game.id, title: game.title }))}
          />
        )}
      </div>
    </main>
  );
}
