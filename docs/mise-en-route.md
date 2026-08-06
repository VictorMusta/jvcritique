# Mise en route — liste à cocher

Tout ce qui reste pour que jvcritiqué soit joignable en HTTPS par tes amis. **Rien ici ne
peut être automatisé** : ce sont les étapes qui touchent des secrets ou l'infrastructure
partagée du VPS, et qui doivent donc rester dans tes mains.

Compter **30 à 45 minutes**, en une seule passe.

État de départ, déjà acquis :

- [x] Dépôt public créé, 12 commits, **CI verte** sur runner propre
- [x] Les 4 secrets GitHub posés et fonctionnels
- [x] `/opt/jvcritique/` existe sur le VPS — le `rsync` de la pipeline l'a créé
- [x] `jvcritique.duckdns.org` → `212.227.82.119`, ports 22 / 80 / 443 ouverts
- [x] **V0 fonctionnellement complète** : connexion Discord, rédaction, fil, fiche de jeu,
      pondération et note relue, spoilers, modification d'un avis, confidentialité
- [x] **122 tests** — 105 unitaires, 17 d'intégration contre un vrai PostgreSQL
- [x] 4 migrations commitées, appliquées **automatiquement** par le service `migrate`
      avant le démarrage de l'application (D20) : rien à lancer à la main

---

## 1. Vérifier qui possède les ports 80 et 443

**Pourquoi d'abord :** sur une machine qui héberge quatre projets, éditer le mauvais
fichier de configuration coûte bien plus cher que trente secondes de vérification.

```bash
sudo ss -tlnp | grep -E ':(80|443) '
```

```bash
systemctl status caddy --no-pager | head -5
```

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

- [ ] `caddy` est bien le processus qui écoute sur **80 et 443**
- [ ] **aucun conteneur** ne publie directement 80 ou 443

> Si ces deux points ne sont pas vérifiés, **arrête-toi ici et dis-le moi.** Ça voudrait
> dire que la topologie n'est pas celle que l'architecture décrit, et le bloc Caddy de
> l'étape 4 ne servirait à rien.

## 2. L'application Discord

Portail développeur Discord → New Application → onglet **OAuth2**.

- [ ] Les **deux** URL de redirection sont enregistrées :

```
http://localhost:3000/api/auth/callback/discord
```

```
https://jvcritique.duckdns.org/api/auth/callback/discord
```

- [ ] `CLIENT ID` et `CLIENT SECRET` copiés quelque part de sûr

> Discord ne redirige que vers une URL figurant **exactement** dans cette liste : pas de
> préfixe, pas de joker, la barre oblique finale compte.

## 3. Le fichier `.env` de production

Il n'est **jamais** synchronisé par la pipeline (exclu du `rsync`) et n'existe que sur le
serveur. C'est voulu : il contient tous les secrets.

Génère d'abord la clé de session, **sur ton poste** :

```bash
npx auth secret
```

Puis, sur le VPS, crée `/opt/jvcritique/.env` :

```
POSTGRES_USER=jvcritique
POSTGRES_PASSWORD=<mot de passe long, généré, sans caractère @ : ? / #>
POSTGRES_DB=jvcritique

DATABASE_URL=postgresql://jvcritique:<le même mot de passe>@db:5432/jvcritique

AUTH_SECRET=<la sortie de npx auth secret>
AUTH_DISCORD_ID=<CLIENT ID de l'étape 2>
AUTH_DISCORD_SECRET=<CLIENT SECRET de l'étape 2>
AUTH_URL=https://jvcritique.duckdns.org/api/auth
```

- [ ] Le fichier existe et les huit variables sont renseignées
- [ ] Le mot de passe est **identique** dans `POSTGRES_PASSWORD` et dans `DATABASE_URL`
- [ ] Droits restreints :

```bash
chmod 600 /opt/jvcritique/.env
```

> **Le piège du mot de passe.** `DATABASE_URL` est une URL : un `@`, un `:`, un `/`, un `?`
> ou un `#` dans le mot de passe casse son analyse, et l'erreur parlera de connexion
> refusée plutôt que de syntaxe. Reste sur des lettres et des chiffres.
>
> `db` dans l'URL n'est pas un oubli : c'est le nom du service Compose, résolu sur le
> réseau interne du projet.

## 4. Le bloc Caddy

Le `Caddyfile` est **monolithique et partagé**. Il se modifie à la main, jamais par la
pipeline.

Sauvegarde d'abord — c'est le fichier dont dépendent tous les sites de la machine :

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
```

Ajoute :

```
jvcritique.duckdns.org {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8083
}
```

**Valide avant de recharger.** Une erreur de syntaxe ici fait tomber Lootopia et le site de
ton client, pas seulement le tien :

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

- [ ] La validation répond `Valid configuration`
- [ ] Seulement ensuite :

```bash
sudo systemctl reload caddy
```

## 5. Déclencher le déploiement

```bash
gh workflow run deploy.yml --repo VictorMusta/jvcritique
```

```bash
gh run watch --repo VictorMusta/jvcritique
```

- [ ] Le job `ci` passe (il passait déjà)
- [ ] `Construire et redémarrer les conteneurs du projet` passe
- [ ] `Vérifier que l'application répond` passe

> Le premier build est long : il compile l'image Docker sur le VPS. Les suivants
> réutilisent les couches.
>
> Si Compose échoue, il **nomme la variable manquante en français** — c'est la syntaxe
> `${VAR:?message}` du `compose.yml`. Lis le message, il désigne la ligne du `.env` à
> corriger.

## 6. Vérifier de bout en bout

- [ ] `https://jvcritique.duckdns.org` répond en HTTPS avec un certificat valide
- [ ] Le cadenas du navigateur ne montre aucun avertissement
- [ ] « Se connecter avec Discord » aboutit et te ramène connecté
- [ ] Ça marche depuis ton **téléphone**, pas seulement depuis ton poste

Diagnostic si ça coince :

```bash
docker compose --project-name jvcritique logs --tail=100 app
```

```bash
docker compose --project-name jvcritique ps
```

Les certificats côté Caddy :

```bash
sudo journalctl -u caddy --since '10 min ago' --no-pager | tail -30
```

---

## En cas de blocage : le repli

Si l'étape 1 révèle une topologie inattendue, ou si le build sur le VPS s'enlise, un
tunnel depuis ton poste donne une URL HTTPS publique en quelques minutes :

```bash
cloudflared tunnel --url http://localhost:3000
```

Ça ne survit pas à la fermeture de ton PC, mais ça permet une session de test à cinq un
samedi matin. Il faudra ajouter l'URL du tunnel aux redirections Discord.

## Deux décisions qui t'attendent, sans urgence

- **`.env.example`** — mes permissions m'interdisent de lire les fichiers d'environnement,
  donc je ne l'ai pas publié. Ouvre-le, confirme qu'il ne contient que des noms de
  variables et des valeurs bidon, et je l'ajoute au dépôt.
- **`_bmad-output/`** — exclu du dépôt public parce que `architecture.md` décrit la
  topologie du VPS et nomme des projets clients. Quand tu veux, je neutralise cette
  section et on publie : c'est la meilleure pièce du portfolio.
