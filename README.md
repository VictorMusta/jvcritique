# jvcritiqué

Journal d'avis sur les jeux vidéo pour un petit cercle d'amis. On note un jeu sur 20, ou on
note sept domaines et la note globale s'en déduit — pondérée par l'importance que **chacun**
accorde à chaque domaine.

C'est là tout l'intérêt : deux personnes lisant le même avis ne voient pas la même note. Si
tu te fiches de la bande-son et que la durée de vie t'obsède, l'avis d'un ami se recalcule
selon **tes** critères. Le projet est né d'un échec précis — ne pas réussir à convaincre
cinq amis de jouer à Valheim.

Aucune ambition commerciale, aucune publicité, aucune croissance recherchée.

## Ce qui rend le projet un peu particulier

- **Un moteur de notation unique**, fonction pure, qui sert à la fois la note de l'auteur et
  la note recalculée du lecteur. Trois modes d'obtention, et le mode fait partie du
  résultat : une moyenne de repli ne se fait jamais passer pour un calcul personnalisé.
- **Les poids des domaines non notés sont redistribués**, jamais comptés comme des zéros.
  La différence entre « ce domaine ne compte pas » et « ce domaine vaut zéro » vaut
  plusieurs points sur 20.
- **Aucune validation de cohérence.** Un seul domaine noté 20 et le reste déclaré sans
  objet donne 20/20, et c'est accepté. On ne peut pas exiger l'objectivité d'un ressenti —
  la comparabilité se traite en annonçant l'échantillon, pas en refusant la note.
- **Les contraintes vivent dans la base**, pas seulement dans le code. Un état interdit est
  refusé par PostgreSQL même si une validation applicative est oubliée.

## Pile technique

Next.js 16 (App Router, RSC) · TypeScript · Drizzle ORM sur PostgreSQL · Auth.js avec
Discord comme fournisseur unique · Tailwind · Vitest.

**Sans tRPC** : les mutations passent par des actions serveur. Une couche de moins pour un
projet dont le client et le serveur sont le même déploiement.

## Développement local

Prérequis : Node 22+, Docker.

### 1. Dépendances

```bash
npm install
```

> Un `.npmrc` local force le registre npm public. Il existe parce que la machine de
> développement est configurée pour un Artifactory d'entreprise injoignable ailleurs.

### 2. Base de données

```bash
docker run -d --name jvcritique-dev-db -e POSTGRES_USER=jvcritique -e POSTGRES_PASSWORD=devlocal -e POSTGRES_DB=jvcritique -p 55432:5432 postgres:17-bookworm
```

Port **55432** et non 5432 : la machine héberge d'autres PostgreSQL, et un port décalé
supprime la question du conflit au lieu de la déplacer.

### 3. Variables d'environnement

Copier `.env.example` vers `.env`, puis renseigner :

```
DATABASE_URL=postgresql://jvcritique:devlocal@localhost:55432/jvcritique
AUTH_SECRET=<sortie de `npx auth secret`>
AUTH_DISCORD_ID=<application Discord de développement>
AUTH_DISCORD_SECRET=<idem>
```

L'application Discord de développement doit déclarer la redirection
`http://localhost:3000/api/auth/callback/discord`.

### 4. Migrations et démarrage

```bash
npm run db:migrate
```

```bash
npm run dev
```

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests unitaires — aucune infrastructure requise |
| `npm run test:db` | Tests d'intégration — exigent une base migrée |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Génère une migration depuis le schéma |
| `npm run db:migrate` | Applique les migrations |
| `npm run db:studio` | Explorateur de base |

> `npm run lint` appelle `eslint .` et non `next lint` : cette commande a été **supprimée
> dans Next 16**, où elle interprétait `lint` comme un nom de dossier et **sortait en code
> 0** — une porte de qualité verte qui ne vérifiait rien.

## Tests

Deux niveaux, et chacun attrape ce que l'autre ne peut pas voir.

**Unitaires** (`src/**/*.test.ts`), colocalisés avec le code. Ils couvrent le moteur de
notation et ses cas dégénérés, et le type `Result`. Aucune infrastructure, quelques
centaines de millisecondes.

**Intégration** (`tests/db/`). Ils vérifient que la **base** refuse les états interdits. Ce
n'est pas de la redondance : la première version d'une contrainte `CHECK` acceptait une
ligne qui n'affirmait ni note ni « pas évaluable », parce qu'un `CHECK` de PostgreSQL ne
rejette une ligne que si son expression vaut `FALSE` — et l'expression valait `NULL`. Ni le
typage ni les tests unitaires ne pouvaient le voir.

Les deux niveaux tournent en CI, et **un test rouge empêche le déploiement**.

## Structure

```
src/
├── domain/          fonctions pures — n'importe RIEN de Next, Drizzle ou React
│   ├── scoring/     le moteur de notation, implémentation unique
│   └── rounding.ts  une décimale, à un seul endroit
├── server/
│   ├── db/          schéma et requêtes — seul endroit qui parle à la base
│   ├── auth/        Auth.js, Discord uniquement
│   ├── actions/     une mutation = une action, session vérifiée en 1re ligne
│   └── result.ts    type Result discriminé, forme figée
├── app/             routes App Router
└── messages/fr.ts   libellés externalisés
docs/
├── lexicon.md       correspondance français ↔ anglais, NORMATIVE
├── deploiement.md   pipeline et préparation du serveur
└── mise-en-route.md liste à cocher du premier déploiement
```

Le code est en **anglais**, le glossaire du produit en **français**. La table de
correspondance de [docs/lexicon.md](docs/lexicon.md) est normative : sans elle, deux
traductions du même terme finissent par créer deux concepts.

## Déploiement

GitHub Actions → SSH → Docker Compose sur un VPS mutualisé. Les migrations s'appliquent
avant le démarrage de l'application, et **un test rouge bloque le déploiement**.

Le VPS héberge d'autres services : le nettoyage d'images est borné au projet par étiquette
Compose, PostgreSQL ne publie aucun port, l'application n'écoute que sur la boucle locale
derrière un proxy inverse, et l'automatisation ne touche jamais la configuration partagée
du proxy.

Voir [docs/deploiement.md](docs/deploiement.md) et
[docs/mise-en-route.md](docs/mise-en-route.md).
