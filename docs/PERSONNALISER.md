# Personnaliser l'interface

Toutes tes images, polices et sons se deposent dans ton dossier cloud (`VTT_ASSETS`).
Elles ne sont jamais envoyees sur GitHub. Rien a relancer : un simple F5 dans
le navigateur suffit.

## Les polices de World of Warcraft

Copie les fichiers depuis ton installation du jeu
(`World of Warcraft\_retail_\Fonts\`) vers le dossier `polices\` :

| Fichier | Usage |
|---|---|
| `FRIZQT__.TTF` | Titres, noms, boutons, toute l'interface (Friz Quadrata) |
| `MORPHEUS.TTF` | Textes longs : pages du grimoire, journal de quetes (Morpheus) |
| `ARIALN.TTF` | Chiffres des barres et discussion (Arial Narrow) |

Noms acceptes aussi : `FrizQuadrata.woff2` / `.otf` / `.ttf` et
`Morpheus.woff2` / `.otf` / `.ttf` (le fichier `polices\LISEZ-MOI.txt` de ton
cloud les rappelle). Apres avoir depose une police : **Ctrl + F5**.

Sans ces fichiers, l'interface utilise automatiquement Palatino Linotype, une
police proche installee avec Windows.

**Comment c'est branche** : `client/src/styles/theme.css` declare les polices
(`@font-face`) avec l'adresse `/medias/polices/<fichier>`. Le serveur sert
cette adresse depuis le dossier `polices` de **ton** `VTT_ASSETS` (celui du
`.env` du PC qui lance la partie). Trois variables les distribuent partout :
`--police-ui` (Friz Quadrata), `--police-texte` (Morpheus), `--police-chiffres`
(Arial Narrow). Pour changer de police, on ne touche qu'a ces trois lignes.

## Les sons

Le dossier `sons\` de ton cloud (cree au premier lancement, avec un
`LISEZ-MOI.txt`) accueille les effets sonores. Les noms attendus, sans
tenir compte de l'extension (`.ogg`, `.mp3`, `.wav`, `.m4a`, `.webm`) :

| Fichier | Quand |
|---|---|
| `murmure` | Un murmure (message prive) arrive |
| `quete-nouvelle` | Le MJ donne une quete |
| `quete-terminee` | Le MJ termine une quete |
| `combat` | Debut d'un combat (jet d'initiative) |

Un fichier absent est remplace par un petit son fabrique par le navigateur.
Tout autre fichier (ex. `rugissement-dragon.ogg`) apparait dans la
« soundboard » du MJ : bouton haut-parleur en bas a droite.

## Portraits des personnages

### Portraits proposes a l'ecran de creation

L'ecran de creation propose, au centre, les images de `portraits\` dont le nom
commence par l'identifiant de la race (celui de `races.json`), suivi d'un
tiret ou d'un point. Le joueur les fait defiler avec les fleches.

| Race | Fichiers proposes |
|---|---|
| Orc | `orc-1.png`, `orc-2.png`, `orc-femme.webp`... |
| Elfe de la nuit | `elfe-de-la-nuit-1.png`, `elfe-de-la-nuit-2.png`... |

Le portrait choisi est enregistre dans la fiche : il apparait ensuite dans
les cadres du groupe.

### Personnages crees par le MJ

Pour une fiche sans portrait choisi, une image nommee d'apres le nom du
personnage en minuscules, sans accents, les espaces remplaces par des tirets :

| Personnage | Fichier |
|---|---|
| Thrall | `thrall.png` |
| Jaina Portvaillant | `jaina-portvaillant.png` |

Le portrait apparait dans les cadres du groupe et au centre de la fiche de
personnage. Sans image, les initiales s'affichent.

## Bibliotheque d'icones et selecteur

Le dossier `icones\` peut contenir **toutes** les icones de WoW (des dizaines
de milliers) : le serveur ne lit la liste des noms qu'une fois, et ne renvoie
que les resultats d'une recherche.

- **Ou les mettre ?** Conseille : sur le disque LOCAL de chaque PC (elles ne
  changent jamais, et Google Drive gere mal des milliers de petits fichiers).
  Dans le `.env` de chaque PC : `VTT_ASSETS_ICONES=D:\WoW-Icones`.
  Les deux PC doivent avoir la meme bibliotheque (une copie unique, ex. un zip).
- **Le selecteur** (MJ) : Bestiaire > Nouveau monstre (ou Modifier) > Icone >
  « Choisir... ». On cherche par mots du NOM DE FICHIER, en anglais :
  `head gnoll`, `fire ball`, `sword`. Raccourcis : `inv_misc_head` (tetes de
  creatures), `achievement_boss` (boss), `inv_` (objets), `spell_` (sorts),
  `ability_` (techniques), `achievement_character` (races).
- L'icone choisie sert dans le bestiaire ET d'image au pion du monstre sur la
  carte (sauf si tu donnes un « Jeton » : une image du dossier `jetons\`).
- Icones ajoutees pendant une partie : bouton **Actualiser** du selecteur.

## Textures d'interface (dossier interface)

Le dossier `interface\` (cree au demarrage du serveur, avec un LISEZ-MOI)
accueille les textures d'interface (boutons, cadres, curseurs...). Copie-les
**sans les renommer, avec leurs sous-dossiers d'origine** (ex. depot
`Gethe/wow-ui-textures` : `interface\Buttons\UI-Quickslot2.png`). C'est le code
qui fera la correspondance avec chaque element de l'interface.

## Images des pions (jetons)

Chaque pion de la carte affiche une image dans son rond (sinon ses initiales) :

- un **heros** : son portrait (celui choisi a la creation, ou `portraits/<nom>.png`) ;
- un **monstre** : `jetons/<id du monstre>.png` (ex. `jetons/gnoll.png`), ou le
  fichier indique par le champ `"jeton"` du bestiaire.

Une image carree (ou presque), vue de dessus ou en buste, rend le mieux : elle
est recadree en rond automatiquement. Apres avoir depose un fichier : F5.

## Icones (objets, sorts, auras, races, classes, factions)

Dans `icones\`, une image par icone, du nom indique dans le compendium (champ
`icone`), ou a defaut de son `id` : `epee-longue.png`, `empoisonne.png`...
Formats : `.png`, `.jpg`, `.webp`, `.gif`, `.svg`. Sans image : un carre gris.

L'ecran de creation cherche, sauf autre nom indique dans le referentiel :
`faction-alliance.png`, `faction-horde.png`, `race-orc.png`, `race-nain.png`...,
`classe-guerrier.png`, `classe-roublard.png`... (l'`id`, pas le nom affiche).
Sans image : une pastille avec les initiales, a la couleur de la classe.

## Les griffons de la barre d'actions

Par defaut, la barre d'actions est encadree de deux ailes dorees dessinees pour
le projet. Pour mettre tes propres images, depose dans `icones\` :

- `ui-griffon-gauche.png`
- `ui-griffon-droite.png`

(format conseille : environ 170 x 128 px, fond transparent)

## Couleurs, bordures, tailles

Tout est regroupe dans un seul fichier : `client/src/styles/theme.css`
(section `:root`). Par exemple `--case-sac` (taille des cases du sac) ou
`--ressource-mana` (couleur de la barre de mana). Apres une modification :
`npm run partie` recompile l'interface.
