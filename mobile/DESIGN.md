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
| `pink`           | `#FF2D8A`                | Marque « Synkup », boutons d'action (fond) avec icône ou texte blanc, icônes sur bouton gris, spinners, tampon ENVOYER   |
| `cardBackground` | `#E6E6EB`                | Placeholder derrière une photo qui charge                                                                                 |

Règles : la marque est toujours en rose. L'action principale est un bouton rose (rond ou
pilule) avec icône ou texte blanc, comme le +. L'action secondaire est un rond gris avec icône
rose. La menthe ne sert qu'en accent, par exemple la pastille de compteur. Pas de mode sombre.

## Formes (`Radii`)

- `card` 40 : carte de swipe.
- `tile` 18 : tuiles de la grille.
- `pill` 999 : tout bouton rond ou pilule (40 pour les boutons d'en-tête, 64 à 68 pour les
  boutons d'action, 56 pour les boutons de message). Les étiquettes d'info n'ont pas de fond.

Ombres uniquement sous les éléments flottants (carte de swipe, bouton +) : noir, opacité
0,18, rayon 16 à 24, décalage vertical 8 à 12.

## Typographie

Police système arrondie (`Fonts.rounded`, SF Rounded sur iOS, fallback normal ailleurs).
Tout est gras.

- Marque « Synkup » : 30, weight 900, letterSpacing -0.5, rose.
- Titre d'écran ou d'album : 26 à 32, weight 800 à 900, centré.
- Chiffre d'étiquette : 20, weight 800, `tabular-nums`. Unité à côté : 14, weight 600, muted.
- Corps et aides : 14 à 16, weight 600, muted, centré.
- Texte sur photo : 15, weight 700, blanc, dans une pilule `rgba(20,20,26,0.6)`.
- Tampons de swipe : 22, weight 900, letterSpacing 1.5, majuscules.

## Structure des écrans

En-tête commun : rangée avec la marque à gauche et une étiquette d'info ou un bouton rond à
droite. L'étiquette d'info (« 12 photos », « 15 à trier », « 3 / 32 ») n'a pas de fond : seul
ce qui est cliquable porte le rond gris, pour qu'on ne confonde jamais les deux. Un écran enfant ajoute un rond gris à gauche de la marque : ✕ pour une modale,
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
- Mon profil (`/profile`, depuis le menu) : chevron retour + marque, titre « Mon profil »,
  sous-titre centré. Photo de profil ronde de 112 au centre (bord `card` 4, pastille rose 36
  avec appareil photo en bas à droite, « Touche la photo pour la changer » dessous ; le tap
  ouvre le sélecteur natif, sans recadrage : sur iOS le recadrage force l'ancien contrôleur
  photo, lent à s'ouvrir). Pour habiller la page sans l'alourdir : une
  carte `card` arrondie 18 avec deux chiffres séparés par un filet (albums, photos
  partagées). Formulaire : deux `TextField` (surnom, email) puis pilule rose
  « Enregistrer » 56 pleine largeur (ombre seulement quand il y a quelque chose à enregistrer).
  Retour par un toast sombre en haut, sous la barre de statut (« Profil enregistré », 2,2 s).
- `TextField` : libellé en capitales 13 muted au-dessus, carte `card` arrondie 18 de 56 de
  haut, bordure 2 transparente qui passe au rose au focus (150 ms), texte 17 gras, bouton
  d'effacement rond gris quand le champ est focalisé et rempli, message dessous (aide en
  muted, erreur en rose). Validation à la saisie une fois le champ touché.
- Menu (`MenuSheet`) : feuille coulissante par le bas en calque (pas une route), fond dépoli
  clair à 45 %, carte `card` arrondie 40 à 8 px des bords avec poignée. Liste sur fond
  `background` arrondie 24 : rond blanc avec icône rose, libellé 17 gras, chevron muted,
  séparateurs fins. En bas, pilule grise « Se déconnecter » en rose avec icône. Fermeture : tap
  sur le fond, glissement vers le bas (90 px ou vélocité 700), retour Android. Entrée en ressort
  sans rebond, sortie 200 ms.
- Album (`/album/[id]`) : chevron retour à gauche de la marque. Pendant le chargement, pas
  d'étiquette de compteur et un spinner rose centré sur tout l'écran (taille small agrandie à
  1,4, soit ~28, la même que le pull-to-refresh), l'en-tête restant visible. Album vide :
  `EmptyState` centré dans l'espace restant sous l'en-tête (remonté de 32 pour compenser le
  bouton +) : émoji dans un rond gris de 88, titre 22 gras, phrase en muted à la deuxième
  personne et au ton léger (« Sois la première personne à dégainer : ajoute les tiennes avec le
  bouton + »). Erreur et album introuvable réutilisent la même présentation. Le contenu défile
  sous la barre de statut, laissée transparente et sans voile. Fond `background`, grille 3 colonnes, espacement 8, marge latérale 16, tuiles
  carrées arrondies (pression : opacité 0,85, échelle 0,97). Bouton + flottant rond rose, icône
  blanche, centré en bas : en Liquid Glass (`GlassView` d'`expo-glass-effect`, style `regular`,
  teinte `pinkGlass`, sans `isInteractive` qui étire le verre sous le doigt) sur iOS 26+, sinon
  rond rose plein avec ombre. Pression : soulèvement maison, échelle 1,08 en ressort et voile
  blanc enfant à 22 %. Jamais d'opacité sur le verre lui-même ni sur ses parents.
  Mode sélection (après tap sur le bouton de téléchargement) : un bandeau apparaît sous la
  date (carte `card` arrondie 18, icône rose dans un rond gris 32, texte muted 14 ; marge
  haute 4 pour compenser le gap de l'en-tête et la ligne de la date, de sorte que l'espace
  visuel soit le même au-dessus et en dessous, ~24) : « On
  t'a pré-sélectionné les photos qui n'ont pas encore été enregistrées sur ce téléphone », ou,
  si tout est déjà là, « Tu as déjà toutes les photos sur ce téléphone. Coche celles que tu
  veux enregistrer à nouveau ». Le bouton devient ✕, les tuiles
  non cochées sont voilées de blanc à 45 % avec un anneau blanc en haut à droite, les tuiles
  cochées gardent la photo nette avec un rond rose et une coche blanche. Le tap sur une tuile
  bascule la sélection au lieu d'ouvrir le visualiseur. L'action prend la place du bouton +
  en bas (zone des boutons, tout à la hauteur du +, 68, marge latérale 24) : collé à gauche un rond gris opaque avec
  une flèche retour rose (`arrow.uturn.backward` / `undo`) pour quitter la sélection, collé à droite un rond rose avec l'icône de
  téléchargement blanche et une pastille menthe (bord `background` 2 px, chiffre `onMint` 13) à cheval
  en haut à droite indiquant le nombre de photos cochées, « 0 » compris : le bouton reste rose et actif, un
  tap sans sélection ne fait rien. Pendant l'enregistrement, la `ProgressModal` (composant partagé
  avec l'envoi manuel du tri, pilotée par `useProgressOverlay`) bloque l'écran (fond dépoli clair à 50 %, carte `background` arrondie 40, largeur max 260, hauteur fixe 150 pour ne pas se réajuster entre progression et résultat, ombre) :
  titre « Enregistrement », compteur « 3 / 12 » en muted, barre de progression 8 px rose sur
  `surfaceStrong` dont le remplissage s'anime en 260 ms. À la fin, un rond rose de 48 avec une
  coche blanche (sombre avec « ! » en cas d'erreur) et le résultat, puis fermeture automatique
  après 1,6 s (2,6 s en erreur). Entrée et sortie en zoom court (180 / 150 ms), sans rebond.
  Le + revient ensuite. Rien n'est épinglé au scroll. Une photo supprimée de la galerie
  reste considérée comme présente (pas de vérification d'existence) : l'utilisateur la recoche
  à la main s'il la veut de nouveau.
- Tri (swipe) : à droite de l'étiquette « N à trier », un rond gris 40 avec l'icône galerie
  rose (`photo.on.rectangle.angled` / `photo_library`) ouvre le sélecteur natif du système
  (`expo-image-picker`, PHPicker / Photo Picker, multi-sélection sans limite) pour choisir des
  photos hors du flux de swipe ; les photos choisies sont envoyées une par une dans la
  `ProgressModal` (titre « Envoi », compteur, barre), retirées des candidates, et celles déjà
  dans l'album sont ignorées ; le résultat s'affiche puis la modale se ferme seule, et si au moins une photo est partie
  l'écran de tri se ferme dans la foulée pour revenir à l'album (y compris depuis l'état
  « Tout est trié »).
  Modale transparente en fondu, `BlurView` clair (intensité 70) + voile blanc
  à 30 % par-dessus l'album. Carte plein cadre arrondie 40 avec la date de la photo en pilule
  sombre centrée en bas. Actions : rond gris ✕ rose, puis pilule rose « Envoyer » avec
  icône nuage-flèche blanche. Tampons de swipe : ENVOYER rose, PASSER `text` sombre, texte blanc. Pas de texte d'aide sous les actions. La pilule « à trier » n'apparaît
  qu'une fois le nombre connu.
- Visualiseur photo : calque rendu par-dessus l'album (pas une route : ouverture et fermeture
  sont un changement d'état, fondu 120 ms, pour ne jamais bloquer les touches). Même fond dépoli. En-tête ✕ + marque + étiquette « 3 / 32 ». Photo dans une
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
  entrée 180 ms par le côté opposé). Entrée de la carte en `ZoomIn` 180 ms.

## Icônes

`expo-symbols` avec un nom par plateforme (`{ ios, android, web }`) et un `fallback` texte.
Poids `bold` ou `heavy`. Envoyer : `icloud.and.arrow.up` / `cloud_upload` (nuage avec flèche montante, trait fin `semibold`).
Passer et fermer : `xmark` / `close`. Ajouter : `plus` / `add`.
Galerie : `photo.on.rectangle.angled` / `photo_library`. Photo de profil : `camera.fill` /
`photo_camera`. Retour d'écran empilé : `chevron.left` / `arrow_back`.

## Pièges connus

- Ne pas utiliser `<Link asChild>` autour d'un `Pressable` dont le `style` est une fonction :
  le Slot écrase le style. Utiliser `router.push`.
- Avec une modale transparente, lire les insets via `useSafeAreaInsets()` plutôt qu'un
  `SafeAreaView` local, sinon la première frame s'affiche sans marge haute.
- Pas d'ombre ni d'opacité sur le parent d'une `GlassView` : ça casse l'effet de verre.
- Pour un fond « tap pour fermer », faire du fond un `Pressable` parent du contenu plutôt
  qu'un calque absolu derrière lui. Si des gestes couvrent aussi le fond, passer par un
  `Gesture.Tap` : un geste actif annule les touches des boutons natifs.
- Le visualiseur et le menu sont des calques dans l'écran, pas des routes : une modale de
  navigation bloque les touches pendant ses transitions et paraît lente.
- Pour qu'une liste défile sous la barre de statut, utiliser
  `contentInsetAdjustmentBehavior="automatic"` sur iOS (position initiale et pull-to-refresh
  gérés par le système) et un `paddingTop` + `progressViewOffset` sur Android. Un `contentInset`
  posé à la main ne s'applique pas correctement sur un écran empilé.
- Dans un calque piloté par un `Gesture.Pan` (feuille de menu), utiliser le `Pressable` de
  `react-native-gesture-handler` pour les boutons internes : celui de React Native avale le
  début du glissement.
- Reanimated : ne pas poser une animation d'entrée/sortie (`entering`/`exiting`) et un style
  animé (`useAnimatedStyle`) sur le même nœud, l'une écrase l'autre ; envelopper dans une vue
  dédiée. Sur `expo-blur`, la prop s'appelle `blurMethod` (`experimentalBlurMethod` est dépréciée).
- Hermes sous Expo Go n'a pas `Intl.RelativeTimeFormat` : les dates relatives sont écrites à la
  main dans `src/types/album.ts`.
