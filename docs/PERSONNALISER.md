# Personnaliser l'interface

Toutes tes images et polices se deposent dans ton dossier cloud (`VTT_ASSETS`).
Elles ne sont jamais envoyees sur GitHub. Rien a relancer : un simple F5 dans
le navigateur suffit.

## Les polices de World of Warcraft

Copie les fichiers depuis ton installation du jeu
(`World of Warcraft\_retail_\Fonts\`) vers le dossier `polices\` :

| Fichier | Usage |
|---|---|
| `FRIZQT__.TTF` | Titres et interface (Friz Quadrata) |
| `MORPHEUS.TTF` | Textes des parchemins (Morpheus) |
| `ARIALN.TTF` | Chiffres des barres et discussion (Arial Narrow) |

Sans ces fichiers, l'interface utilise automatiquement Palatino Linotype, une
police proche installee avec Windows.

## Portraits des personnages

Dans `portraits\`, une image par personnage, nommee d'apres son nom en
minuscules, sans accents, les espaces remplaces par des tirets :

| Personnage | Fichier |
|---|---|
| Thrall | `thrall.png` |
| Jaina Portvaillant | `jaina-portvaillant.png` |

Le portrait apparait dans les cadres du groupe et au centre de la fiche de
personnage. Sans image, les initiales s'affichent.

## Icones (objets, sorts, auras)

Dans `icones\`, une image par icone, du nom indique dans le compendium (champ
`icone`), ou a defaut de son `id` : `epee-longue.png`, `empoisonne.png`...
Formats : `.png`, `.jpg`, `.webp`, `.gif`, `.svg`. Sans image : un carre gris.

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
