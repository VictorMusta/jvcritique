# Déploiement

Le VPS est **mutualisé** : plusieurs autres services y tournent. Tout ce qui suit est
conçu pour ne jamais les toucher (INV-4). Deux règles qui en découlent et qui ne se
négocient pas :

- **L'automatisation ne touche jamais l'infrastructure partagée.** Pas d'opération sur le
  démon Docker global, pas de modification automatisée de la configuration de Caddy.
- **Le nettoyage d'images est borné au projet** par étiquette Compose. Un
  `docker image prune -f` sans filtre balaierait les images des voisins.

## Ce que la pipeline fait

`main` → `ci.yml` (lint, typage, tests, build) → **si vert** → `deploy.yml` :

1. `rsync` du code vers `/opt/jvcritique/`, en excluant `.env` (il vit sur le serveur).
2. `docker compose up -d --build` avec le nom de projet `jvcritique`.
3. Le service `migrate` applique les migrations et sort ; `app` ne démarre qu'après son
   succès (D20).
4. Vérification que l'application répond sur `127.0.0.1:8083`.

Un test rouge **empêche** le déploiement. C'est voulu : les migrations s'appliquent avant
le démarrage, donc déployer du code cassé engagerait un changement de schéma pour rien.

## Le nom d'hôte

**V0 : `jvcritique.duckdns.org`** — sous-domaine gratuit, créé en deux minutes sur
[duckdns.org](https://www.duckdns.org) en pointant l'IPv4 du VPS. Aucune attente de
propagation.

Caddy obtient un **vrai certificat Let's Encrypt** dessus : `duckdns.org` figure sur la
Public Suffix List, donc chaque sous-domaine compte comme un domaine enregistré distinct
pour les quotas de délivrance. Le défi HTTP-01 ne demande que le port 80, déjà ouvert.

**À savoir avant de s'y installer durablement.** Sur un suffixe partagé, un cookie portant
l'attribut `domain=.duckdns.org` serait lisible par n'importe quel autre sous-domaine du
service. Auth.js pose des cookies **liés à l'hôte** par défaut, donc la session est isolée
— mais il ne faut jamais configurer de `domain` sur les cookies ici. C'est une raison de
fond de passer à un vrai domaine, pas seulement une question d'allure.

**Migration vers un vrai domaine, plus tard, sans rupture** : une application Discord
accepte **plusieurs URL de redirection**. On ajoute la nouvelle à côté de l'ancienne, on
ajoute un bloc Caddy, on change `AUTH_URL`, on redémarre. Aucun compte n'est perdu :
l'identité d'un Utilisateur est son identifiant Discord, pas l'URL par laquelle il est
arrivé.

## Préparation du serveur — une seule fois, à la main

### 1. Le dossier

```bash
sudo mkdir -p /opt/jvcritique
sudo chown "$USER":"$USER" /opt/jvcritique
```

### 2. Le fichier `.env` de production

Il **n'est jamais synchronisé** (exclu du `rsync`) et n'existe que sur le serveur. À créer
dans `/opt/jvcritique/.env` :

```
POSTGRES_USER=jvcritique
POSTGRES_PASSWORD=<mot de passe long, généré>
POSTGRES_DB=jvcritique

# Le nom d'hôte `db` est celui du service Compose, résolu sur le réseau du projet.
DATABASE_URL=postgresql://jvcritique:<le même mot de passe>@db:5432/jvcritique

AUTH_SECRET=<sortie de `npx auth secret`>
AUTH_DISCORD_ID=<identifiant de l'application Discord>
AUTH_DISCORD_SECRET=<secret de l'application Discord>
AUTH_URL=https://jvcritique.duckdns.org/api/auth
```

Restreindre les droits, puisqu'il contient des secrets :

```bash
chmod 600 /opt/jvcritique/.env
```

### 3. L'application Discord

Sur le portail développeur Discord, une application avec **deux** URL de redirection —
la locale pour développer, la publique pour tes amis :

```
http://localhost:3000/api/auth/callback/discord
https://jvcritique.duckdns.org/api/auth/callback/discord
```

Les deux, et pas l'une ou l'autre : la locale sert à développer, la publique à tes amis.
Discord n'accepte une redirection que si elle figure **exactement** dans cette liste.

### 4. Le bloc Caddy

Le `Caddyfile` est **monolithique** et partagé avec les autres services. Il se modifie
**à la main**, jamais par la pipeline. Ajouter :

```
jvcritique.duckdns.org {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8083
}
```

Valider **avant** de recharger — une erreur de syntaxe ferait tomber tous les sites de la
machine, pas seulement celui-ci :

```bash
caddy validate --config /etc/caddy/Caddyfile
```

Puis seulement :

```bash
sudo systemctl reload caddy
```

## Registre des ports

| Port | Occupant |
|---|---|
| 8083 | jvcritiqué, sur la boucle locale uniquement |

L'application écoute sur `127.0.0.1:8083` et **pas** sur `0.0.0.0`. Caddy est le seul
frontal : publier sur toutes les interfaces exposerait l'application en HTTP nu, sans TLS
ni en-têtes de sécurité, à qui connaît le port.

PostgreSQL **ne publie aucun port**. Une instance tourne déjà sur la machine ; ne rien
publier supprime la question du conflit au lieu de la déplacer.

## Secrets GitHub attendus

| Secret | Contenu |
|---|---|
| `SSH_HOST` | adresse IPv4 du VPS |
| `SSH_USER` | utilisateur de déploiement |
| `SSH_PRIVATE_KEY` | clé privée dédiée à ce projet |
| `SSH_KNOWN_HOSTS` | sortie de `ssh-keyscan -H <la même adresse>` |

`SSH_HOST` et `SSH_KNOWN_HOSTS` doivent porter **exactement la même chaîne** : l'empreinte
épinglée est indexée sur le nom d'hôte tel qu'il est écrit.

## Diagnostic

```bash
docker compose --project-name jvcritique logs --tail=100 app
```

```bash
docker compose --project-name jvcritique ps
```
