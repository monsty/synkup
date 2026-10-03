# Synkup API

API NestJS de Synkup : utilisateurs, albums, membres et photos. Postgres via Prisma.

## Démarrer

```bash
nvm use                 # Node 24 (voir .nvmrc)
npm install
cp .env.example .env    # puis renseigner DATABASE_URL
npx prisma migrate dev  # crée la base et génère le client
npm run start:dev       # http://localhost:3000
```

## Authentification

Chaque requête porte `Authorization: Bearer <jeton>`. En développement, tant que Clerk n'est pas
branché, un jeton `dev:<userId>:<email>` est accepté. En production, `AuthGuard.verify` vérifie
le JWT Clerk ; rien d'autre ne change.

```bash
curl -H "Authorization: Bearer dev:me:antoine@example.com" http://localhost:3000/albums
```

## Structure

- `prisma/schema.prisma` : modèle de données (User, Album, AlbumMember, Photo, AlbumInvite).
- `src/prisma` : client Prisma partagé.
- `src/auth` : garde d'authentification et décorateur `@User()`.
- `src/albums` : première ressource, `GET /albums`.

Le client Prisma est généré dans `src/generated/prisma` (ignoré par git) : `npx prisma generate`.

## Décisions

- Les photos ne transitent jamais par l'API : URL d'envoi signée vers un bucket S3 compatible
  (Cloudflare R2), puis confirmation. Le hash du fichier, calculé côté téléphone, refuse les
  doublons avant l'envoi (`@@unique([albumId, contentHash])`).
- Le quota de l'offre compte les photos actives des albums dont l'utilisateur est OWNER, et
  c'est le serveur qui refuse quand il est plein.
- Les invitations sont des jetons opaques, expirables et révocables.
- Toolchain : Node 24 + npm 12 (`packageManager`). Les npm 10.x plantent sur le graphe de
  dépendances de Nest 12 / TypeScript 6 (`Cannot read properties of null (reading 'edgesOut')`).
