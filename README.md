# Synkup

Partage tes photos dans un album commun sans effort : l'app te propose les photos de ta galerie prises pendant la période de l'album, tu swipes à droite pour envoyer, à gauche pour passer.

## Structure

- `mobile/` : application Expo (React Native). Voir `mobile/DESIGN.md` pour le thème et `mobile/AGENTS.md` pour les conventions.
- `api/` : backend à venir. Pour l'instant l'app utilise une fausse API en mémoire (`mobile/src/services/album-api.ts`).

## Lancer l'app

```bash
cd mobile
npm install
npx expo start
```
