# Synkup API

API NestJS de Synkup : utilisateurs, albums, membres et photos. Postgres via Prisma.

## Démarrer

```bash
nvm use                    # Node 24 (voir .nvmrc)
npm install
cp .env.example .env       # pointe déjà sur la base Docker locale
docker compose up -d       # Postgres 18 sur localhost:5432
npx prisma migrate deploy  # applique les migrations
npx prisma generate        # génère le client dans src/generated
npm run start:dev          # http://localhost:3000/v1, sonde : /health
```

La configuration est vérifiée au démarrage (`src/config/env.ts`) : une variable manquante
empêche le serveur de démarrer et est nommée dans l'erreur.

## Tests

```bash
npm test                   # tests unitaires (src/**/*.spec.ts)
npm run test:e2e           # API complète sur la base synkup_test, stockage en mémoire
```

Base de test, à créer une fois :

```bash
docker exec synkup-postgres psql -U synkup -c "create database synkup_test;"
DATABASE_URL="postgresql://synkup:synkup@localhost:5432/synkup_test?schema=public" npx prisma migrate deploy
```

Les tests de bout en bout couvrent les règles d'accès (qui voit, modifie, supprime quoi),
l'envoi des photos (doublons, tailles, quota) et la suppression des fichiers.

## Authentification

Chaque requête porte `Authorization: Bearer <jeton>`, le jeton de session Clerk envoyé par l'app.
`AuthGuard` en vérifie la signature avec `CLERK_SECRET_KEY` (clés publiques de l'instance, mises
en cache). À la première requête d'un compte, `UsersService` lit son email, prénom et avatar
chez Clerk et crée la ligne `User` ; l'identifiant est celui de Clerk (`user_…`).

Avec `ALLOW_DEV_TOKENS=true` (jamais en production : le serveur refuse de démarrer), un jeton
`dev:<userId>:<email>` est aussi accepté, compte créé à la volée, pour tester sans l'app :

```bash
curl -H "Authorization: Bearer dev:user_test:test@example.com" http://localhost:3000/v1/albums
```

Sessions : l'instance Clerk de dev garde une session 10 ans, sans expiration à l'inactivité. En
production, une durée personnalisée demande Clerk Pro ; sinon la session est fixée à 7 jours.

## Routes

Toutes les routes sont préfixées par `/v1` (sauf `/health`) : une app publiée garde son
ancienne version des mois, un changement incompatible passera par `/v2`.

| Méthode  | Route                               | Rôle requis   |
| -------- | ----------------------------------- | ------------- |
| `GET`    | `/albums`                           | membre        |
| `POST`   | `/albums`                           | —             |
| `GET`    | `/albums/:id`                       | membre        |
| `PATCH`  | `/albums/:id` (nom, période, cover) | propriétaire  |
| `DELETE` | `/albums/:id`                       | propriétaire  |
| `POST`   | `/albums/:id/leave`                 | membre (pas le propriétaire) |
| `PATCH`  | `/albums/:id/members/:memberId`     | propriétaire  |
| `DELETE` | `/albums/:id/members/:memberId`     | propriétaire  |
| `POST`   | `/albums/:id/cover`                 | propriétaire  |
| `GET`    | `/albums/:id/photos`                | membre        |
| `POST`   | `/albums/:id/photos/uploads`        | membre        |
| `POST`   | `/albums/:id/photos`                | membre        |
| `POST`   | `/albums/:id/photos/delete`         | auteur ou propriétaire |
| `GET`    | `/me`                               | connecté      |
| `PATCH`  | `/me` (surnom, photo de profil)     | connecté      |
| `POST`   | `/me/avatar`                        | connecté      |
| `DELETE` | `/me`                               | connecté      |
| `GET`    | `/albums/:id/invite`                | membre        |
| `POST`   | `/albums/:id/invite/reset`          | propriétaire  |
| `GET`    | `/invites/:token`                   | connecté      |
| `POST`   | `/invites/:token/accept`            | connecté      |

Un album dont on n'est pas membre répond 404, pour ne rien révéler.

## Mon compte

`GET /me` renvoie le profil, l'offre et l'usage du quota (même calcul que celui appliqué à
l'envoi). La photo de profil suit le circuit des couvertures (URL signée, `users/<id>/avatar/`)
et remplace celle de Clerk. L'email est géré par Clerk et ne se modifie pas ici.

`DELETE /me` supprime définitivement : les albums dont l'utilisateur est propriétaire (avec
toutes leurs photos, y compris celles des autres membres), ses photos dans les autres albums,
ses appartenances, sa photo de profil et ses fichiers, puis son compte Clerk. Les appels à
Clerk passent par `ClerkService`, remplacé par un faux dans les tests.

## Invitations

Un album a un seul lien actif à la fois (`INVITE_BASE_URL` + jeton aléatoire de 128 bits),
créé au premier partage. Tout membre peut le partager ; le propriétaire peut le remplacer,
l'ancien cesse alors de fonctionner. L'aperçu (`GET /invites/:token`) montre l'album sans
faire rejoindre ; accepter ajoute la personne comme simple membre, sans effet si elle en fait
déjà partie.

## Contrat avec l'app

Les formes des réponses vivent dans `packages/shared/index.d.ts` (types uniquement, importés
par `import type` des deux côtés) : un changement casse la compilation de l'app et de l'API
plutôt que l'app en production.

## Photos

Les octets ne passent jamais par l'API. Le téléphone prépare trois versions (originale,
affichage 1 600 px et miniature 480 px en JPEG), annonce leurs tailles (50 Mo, 5 Mo et 1 Mo
au plus, signées dans les URL : le stockage refuse un autre fichier), demande des URL d'envoi signées
(`POST …/photos/uploads`, qui refuse tout de suite un doublon ou un album plein), envoie les
fichiers au bucket, puis confirme (`POST …/photos`) : l'API vérifie que les trois objets
existent et crée la photo. Rangement : `albums/<albumId>/photos/<photoId>/{original,display,thumb}`.

Les URL de lecture sont signées à la date du début d'une tranche de 24 h et valables 48 h :
identiques toute la journée, elles profitent du cache d'images de l'app, restent valables au
moins 24 h après réception, et un lien qui fuite expire en 48 h au plus (limite S3 : 7 jours). Supprimer une
photo ou un album efface aussi ses fichiers.

Bucket B2 : privé, région EU, réglage « Keep only the last version » (sinon les fichiers
supprimés restent facturés), clé d'application limitée au bucket.

## Structure

- `prisma/schema.prisma` : modèle de données (User, Album, AlbumMember, Photo, AlbumInvite).
- `src/prisma` : client Prisma partagé.
- `src/auth` : garde d'authentification (jeton Clerk) et décorateur `@User()`.
- `src/users` : création des utilisateurs à partir de Clerk.
- `src/albums` : albums, membres et photos.
- `src/storage` : bucket S3 compatible (URL signées, suppression).

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
