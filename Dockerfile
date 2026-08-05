# syntax=docker/dockerfile:1

# bookworm-slim et non alpine : sharp/libvips — utilisé par l'optimisation d'images de
# Next, puis par FR-8 — publie des binaires pré-compilés pour la glibc, pas pour musl.
# Sur alpine, il faudrait les compiler, ce qui rallonge le build et casse au moindre
# changement de version.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------
# Dépendances
# ---------------------------------------------------------------------------
FROM base AS deps
# .npmrc est copié pour le registre public. Il ne contient aucun jeton.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Les variables d'environnement réelles n'existent pas au moment du build : elles sont
# lues à l'exécution. Sans ce drapeau, la validation Zod de src/env.js ferait échouer
# la construction de l'image.
ENV SKIP_ENV_VALIDATION=1
RUN npm run build

# ---------------------------------------------------------------------------
# Migrations (D20) — conteneur éphémère, appliqué avant le démarrage de l'application
# ---------------------------------------------------------------------------
# Séparé de l'image applicative parce qu'il a besoin de drizzle-kit, donc des
# devDependencies, que l'image de production n'embarque pas.
FROM base AS migrate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src
CMD ["npm", "run", "db:migrate"]

# ---------------------------------------------------------------------------
# Exécution
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production

# Utilisateur non privilégié : un défaut d'exécution de code dans l'application ne
# donne pas les droits root dans le conteneur.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# La sortie `standalone` ne contient que les dépendances réellement atteintes, et un
# server.js autonome. Pas de node_modules complet, pas de npm dans l'image finale.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
