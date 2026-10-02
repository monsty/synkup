# Synkup – Design

Thème clair fixe, « fun » et très arrondi. Les tokens vivent dans `src/constants/theme.ts`
(`Palette`, `Radii`, `Spacing`, `Fonts`). Ne pas inventer de couleurs ou de rayons ailleurs.

## Couleurs (`Palette`)

| Token            | Valeur                   | Usage                                                                                                                     |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `background`     | `#F4F4F7`                | Fond des écrans                                                                                                           |
| `surface`        | `rgba(27,27,31,0.07)`    | Pilules, boutons secondaires (gris translucide)                                                                           |
| `surfaceStrong`  | `rgba(27,27,31,0.12)`    | Idem, plus marqué (bouton « passer »)                                                                                     |
| `surfaceOpaque`  | `#E5E5EA`                | Même rendu que `surface` sur le fond, mais opaque : pour un élément qui peut passer sur des photos (pilule et ✕ épinglés) |
| `text`           | `#1B1B1F`                | Texte principal                                                                                                           |
| `textMuted`      | `#6B6B76`                | Texte secondaire (périodes, unités, aides)                                                                                |
| `onPhoto`        | `#FFFFFF`                | Texte posé sur une photo                                                                                                  |
| `mint`           | `#9FE8D8`                | Action principale (envoyer, bouton +, boutons de message)                                                                 |
| `mintGlass`      | `rgba(159,232,216,0.35)` | Teinte menthe des surfaces Liquid Glass                                                                                   |
| `pinkGlass`      | `rgba(255,45,138,0.6)`   | Teinte rose des surfaces Liquid Glass (bouton +)                                                                          |
| `onMint`         | `#14201C`                | Texte sur fond menthe                                                                                                     |
| `pink`           | `#FF2D8A`                | Marque « Synkup », icônes d'action, spinners, tampon PASSER                                                               |
| `cardBackground` | `#E6E6EB`                | Placeholder derrière une photo qui charge                                                                                 |

Règles : la marque est toujours en rose. L'action principale est un bouton rose (rond ou
pilule) avec icône ou texte blanc, comme le +. L'action secondaire est un rond gris avec icône
rose. La menthe ne sert qu'en accent, par exemple la pastille de compteur. Pas de mode sombre.

## Formes (`Radii`)

- `card` 40 : carte de swipe.
- `tile` 18 : tuiles de la grille.
- `pill` 999 : toute pilule ou bouton rond (hauteur 40 pour les pilules d'info, 64 à 68 pour
  les boutons d'action, 56 pour les boutons de message).

Ombres uniquement sous les éléments flottants (carte de swipe, bouton +) : noir, opacité
0,18, rayon 16 à 24, décalage vertical 8 à 12.

## Typographie

Police système arrondie (`Fonts.rounded`, SF Rounded sur iOS, fallback normal ailleurs).
Tout est gras.

- Marque « Synkup » : 30, weight 900, letterSpacing -0.5, rose.
- Titre d'écran ou d'album : 26 à 32, weight 800 à 900, centré.
- Chiffre de pilule : 20, weight 800, `tabular-nums`. Unité à côté : 14, weight 600, muted.
- Corps et aides : 14 à 16, weight 600, muted, centré.
- Texte sur photo : 15, weight 700, blanc, dans une pilule `rgba(20,20,26,0.6)`.
- Tampons de swipe : 22, weight 900, letterSpacing 1.5, majuscules.

## Structure des écrans

En-tête commun : rangée avec la marque à gauche et une pilule d'info ou un bouton rond à
droite. Un écran enfant ajoute un rond gris à gauche de la marque : ✕ pour une modale,
chevron gauche pour un écran empilé (album). Sous la rangée, un titre centré en gras (26) et
un sous-titre centré en muted. Un bouton d'action secondaire se place à droite de la pilule :
rond gris 40 avec icône rose (ex. téléchargement, `arrow.down.to.line` / `download`), spinner
rose à la place de l'icône pendant l'action.

- Mes albums (accueil) : marque + bouton menu rond gris (`line.3.horizontal` / `menu`) à
  droite, titre « Mes albums », sous-titre « N albums partagés avec toi ». Une carte par ligne
  (`AlbumCard`) : fond `card` blanc, arrondi 40, ombre légère (opacité 0,08, rayon 16).
  Couverture 16:10 avec deux pilules sombres translucides en haut : l'état à gauche (« En
  cours » en rose avec un point menthe, « À venir », « Terminé ») et le nombre de photos à
  droite. Dessous : nom (22, 800), période + état relatif en muted (« Se termine dans 3 jours »,
  « Terminé avant-hier », « Commence le 17 oct. »), puis les membres en avatars chevauchés
  (28, bord `card` 2 px, max 4 puis « +N ») avec « N personnes » et un chevron rose dans un
  rond gris. Sans couverture : icône et « Aucune photo pour le moment » sur `cardBackground`.
  Pression : opacité 0,9, échelle 0,985. Tri des albums : en cours, à venir, terminés.
- Menu (`MenuSheet`) : feuille coulissante par le bas en calque (pas une route), fond dépoli
  clair à 45 %, carte `card` arrondie 40 à 8 px des bords avec poignée. Liste sur fond
  `background` arrondie 24 : rond blanc avec icône rose, libellé 17 gras, chevron muted,
  séparateurs fins. En bas, pilule grise « Se déconnecter » en rose avec icône. Fermeture : tap
  sur le fond, glissement vers le bas (90 px ou vélocité 700), retour Android. Entrée en ressort
  sans rebond, sortie 200 ms.
- Album (`/album/[id]`) : chevron retour à gauche de la marque. Le contenu défile sous la barre
  de statut, laissée transparente et sans voile. Fond `background`, grille 3 colonnes, espacement 8, marge latérale 16, tuiles
  carrées arrondies (pression : opacité 0,85, échelle 0,97). Bouton + flottant rond rose, icône
  blanche, centré en bas : en Liquid Glass (`GlassView` d'`expo-glass-effect`, style `regular`,
  teinte `pinkGlass`, sans `isInteractive` qui étire le verre sous le doigt) sur iOS 26+, sinon
  rond rose plein avec ombre. Pression : soulèvement maison, échelle 1,08 en ressort et voile
  blanc enfant à 22 %. Jamais d'opacité sur le verre lui-même ni sur ses parents.
  Mode sélection (après tap sur le bouton de téléchargement) : le bouton devient ✕, les tuiles
  non cochées sont voilées de blanc à 45 % avec un anneau blanc en haut à droite, les tuiles
  cochées gardent la photo nette avec un rond rose et une coche blanche. Le tap sur une tuile
  bascule la sélection au lieu d'ouvrir le visualiseur. L'action prend la place du bouton +
  en bas (zone des boutons, tout à la hauteur du +, 68, marge latérale 24) : collé à gauche un rond gris opaque avec
  une flèche retour rose (`arrow.uturn.backward` / `undo`) pour quitter la sélection, collé à droite un rond rose avec l'icône de
  téléchargement blanche et une pastille menthe (bord `background` 2 px, chiffre `onMint` 13) à cheval
  en haut à droite indiquant le nombre de photos cochées, « 0 » compris : le bouton reste rose et actif, un
  tap sans sélection ne fait rien. Pendant l'enregistrement, une modale centrée bloque
  l'écran (fond dépoli clair à 50 %, carte `background` arrondie 40, largeur max 260, hauteur fixe 150 pour ne pas se réajuster entre progression et résultat, ombre) :
  titre « Enregistrement », compteur « 3 / 12 » en muted, barre de progression 8 px rose sur
  `surfaceStrong` dont le remplissage s'anime en 260 ms. À la fin, un rond rose de 48 avec une
  coche blanche (sombre avec « ! » en cas d'erreur) et le résultat, puis fermeture automatique
  après 1,6 s (2,6 s en erreur). Entrée et sortie en zoom court (180 / 150 ms), sans rebond.
  Le + revient ensuite. Rien n'est épinglé au scroll. Une photo supprimée de la galerie
  reste considérée comme présente (pas de vérification d'existence) : l'utilisateur la recoche
  à la main s'il la veut de nouveau.
- Tri (swipe) : modale transparente en fondu, `BlurView` clair (intensité 70) + voile blanc
  à 30 % par-dessus l'album. Carte plein cadre arrondie 40 avec la date de la photo en pilule
  sombre centrée en bas. Actions : rond gris ✕ rose, puis pilule rose « Envoyer » avec
  icône d'upload blanche. Tampons de swipe : ENVOYER rose, PASSER `text` sombre, texte blanc. Pas de texte d'aide sous les actions. La pilule « à trier » n'apparaît
  qu'une fois le nombre connu.
- Visualiseur photo : calque rendu par-dessus l'album (pas une route : ouverture et fermeture
  sont un changement d'état, fondu 120 ms, pour ne jamais bloquer les touches). Même fond dépoli. En-tête ✕ + marque + pilule « 3 / 32 ». Photo dans une
  carte arrondie 40 au ratio de l'image, bornée par l'écran. En bas, une pilule grise avec
  l'auteur en gras puis la date en muted. Les gestes couvrent tout l'écran, pas seulement la
  photo : on peut glisser à côté d'une petite photo. Fermeture : ✕, tap hors de la photo, ou
  glissement vertical (le fond s'estompe avec la distance) ; un glissement ne ferme jamais par
  tap, le tap échoue dès que le doigt bouge. Glissement horizontal : photo précédente ou
  suivante, avec résistance au bord. Pas de zoom pour le moment (retiré du POC, à réintroduire
  plus tard, probablement via une bibliothèque dédiée).

## Animations

- Swipe : rotation max 14°, seuil 30 % de la largeur ou vélocité 900, envol 260 ms.
  Carte de derrière à l'échelle 0,92 et décalée de 18 px, qui rejoint 1 pendant le geste.
- Compteur : seuls les chiffres qui changent s'animent (sortie vers le haut 180 ms, entrée
  par le bas 220 ms), positions indexées depuis la droite. Composant `AnimatedCounter`.
- Pression sur un bouton : opacité 0,8 et échelle 0,95.
- Visualiseur : fermeture après 120 px ou vélocité 800 (envol 180 ms, calque en fondu 120 ms,
  fermeture lancée dès le seuil). Navigation après 80 px ou vélocité 600 (sortie 150 ms,
  entrée 180 ms par le côté opposé). Entrée de la carte en `ZoomIn` 220 ms.

## Icônes

`expo-symbols` avec un nom par plateforme (`{ ios, android, web }`) et un `fallback` texte.
Poids `bold` ou `heavy`. Envoyer : `square.and.arrow.up.fill` / `upload`.
Passer et fermer : `xmark` / `close`. Ajouter : `plus` / `add`.

## Pièges connus

- Ne pas utiliser `<Link asChild>` autour d'un `Pressable` dont le `style` est une fonction :
  le Slot écrase le style. Utiliser `router.push`.
- Avec une modale transparente, lire les insets via `useSafeAreaInsets()` plutôt qu'un
  `SafeAreaView` local, sinon la première frame s'affiche sans marge haute.
- Pas d'ombre ni d'opacité sur le parent d'une `GlassView` : ça casse l'effet de verre.
- Pour un fond « tap pour fermer », faire du fond un `Pressable` parent du contenu plutôt
  qu'un calque absolu derrière lui.
