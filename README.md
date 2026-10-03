# Synkup

Partage tes photos dans un album commun sans effort : l'app te propose les photos de ta galerie prises pendant la période de l'album, tu swipes à droite pour envoyer, à gauche pour passer.

## Structure

- `mobile/` : application Expo (React Native). Voir `mobile/DESIGN.md` pour le thème et `mobile/AGENTS.md` pour les conventions.
- `api/` : API NestJS + Prisma (Postgres). Voir `api/README.md`. L'app mobile utilise encore une fausse API en mémoire (`mobile/src/services/album-api.ts`) en attendant le branchement.

## Lancer l'app

```bash
cd mobile
npm install
npx expo start
```
