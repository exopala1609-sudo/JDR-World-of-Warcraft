# Ecrire son compendium

Le compendium est la bibliotheque du MJ : objets, sorts, auras et monstres. Ce sont de
simples fichiers texte au format JSON, ranges dans le dossier `compendium/` de
ton dossier cloud (`VTT_ASSETS`). Tu peux les ouvrir avec le Bloc-notes.

- Le serveur lit **tous** les fichiers `.json` du dossier, sous-dossiers compris.
  Range comme tu veux : `armes.json`, `sorts/mage.json`...
- Au tout premier lancement, trois fichiers `exemple-*.json` y sont deposes
  (donnees de test). Tu peux les modifier, les copier ou les supprimer.
- Apres une modification : bouton **Recharger** de la barre MJ (inutile de
  relancer le serveur). Une erreur de saisie est signalee avec le fichier, la
  position et la raison ; les autres entrees restent utilisables.

## Squelette d'un fichier

```json
{
  "objets": [ ... ],
  "sorts": [ ... ],
  "etats": [ ... ],
  "monstres": [ ... ]
}
```
Les quatre listes sont facultatives. Attention aux virgules : il en faut une
entre deux entrees (une virgule en trop apres la derniere est toleree).
Les lignes qui commencent par `//` sont des commentaires, ignores par le jeu.

## L'identifiant (`id`)

Chaque entree a un `id` que tu choisis : minuscules, chiffres et tirets
(`epee-longue`, `potion-de-soins-superieure`). Il doit etre unique et ne plus
changer ensuite : c'est lui qui relie un objet ramasse a son entree d'origine.

## Objets

```json
{
  "id": "epee-longue",
  "nom": "Epee longue",
  "type": "arme",
  "rarete": "classique",
  "icone": "inv_sword_04",
  "poids": 1.5,
  "valeur": 15,
  "description": "L'arme de base de tout aventurier.",
  "arme": { "degats": "1d8", "typeDegats": "tranchant", "proprietes": ["polyvalente (1d10)"] }
}
```

| Champ | Obligatoire | Valeurs |
|---|---|---|
| `id`, `nom` | oui | |
| `type` | oui | `arme`, `armure`, `bouclier`, `consommable`, `munition`, `objet`, `tresor` |
| `rarete` | oui | `mediocre` (gris), `classique` (blanc), `inhabituel` (vert), `rare` (bleu), `epique` (violet), `legendaire` (orange) |
| `icone` | non | nom d'un fichier du dossier `icones/`, sans extension. Par defaut : l'`id` |
| `poids` (kg), `valeur` (po) | non | nombres, 0 par defaut |
| `empilable` | non | `true` pour les potions, fleches... (elles se regroupent en pile) |
| `description` | non | texte libre |
| `arme` | non | `degats` (formule de des), `typeDegats`, `proprietes` (liste) |
| `armure` | non | `classeArmure`, `categorie` (`legere`, `intermediaire`, `lourde`, `bouclier`), `dexteriteMax` |
| `soins` | non | formule de des, ex. `"2d4+2"`. L'objet s'utilise (barre d'actions, clic droit) |
| `emplacement` | non | ou il se porte, voir ci-dessous |

**Choisir l'icone depuis le jeu** (sans ouvrir de fichier) : Compendium du MJ
(touche 2), onglet Objets ou Sorts, **clic sur l'icone** de la ligne : le
selecteur d'icones s'ouvre (le meme que le bestiaire). Le choix est ecrit dans
`compendium/mes-icones.json` et l'emporte sur le champ `icone` de tes fichiers,
qui ne sont jamais reecrits. « Aucune » revient a l'icone de ton fichier. Les
exemplaires deja donnes a la table (sacs, equipement porte, coffres,
grimoires) prennent aussi la nouvelle icone, en direct.

### Ou se porte un objet (`emplacement`)

Valeurs : `tete`, `cou`, `epaules`, `dos`, `torse`, `chemise`, `tabard`,
`poignets`, `mains`, `taille`, `jambes`, `pieds`, `doigt`, `bijou`,
`une-main`, `deux-mains`, `main-gauche` (bouclier), `distance`.

Sans ce champ, le jeu devine d'apres le type :

| Objet | Emplacement devine |
|---|---|
| arme | `une-main` ; `deux-mains` si ses proprietes contiennent "deux mains" ; `distance` si elles contiennent "munitions" |
| bouclier (ou armure de categorie `bouclier`) | `main-gauche` |
| armure dont `classeArmure` vaut 10 ou plus | `torse` (un plastron) |
| armure dont `classeArmure` vaut moins de 10 | `dos` (un accessoire, comme une cape) |
| autre | ne s'equipe pas |

### Classe d'armure : comment elle est recalculee

A chaque objet equipe ou retire, le serveur recalcule la CA (regles D&D 5e) :

- **plastron** (emplacement `torse`) : `legere` = valeur + DEX ;
  `intermediaire` = valeur + DEX plafonnee (`dexteriteMax`, 2 par defaut) ;
  `lourde` = valeur seule ;
- **sans plastron** : 10 + DEX (+ la defense sans armure de la classe) ;
- **ensuite on ajoute** le bouclier et tous les autres objets portes qui ont
  une `armure` (cape, anneau de protection...).

Exemple : armure de cuir (11) + DEX +2 + bouclier (2) + cape (1) = CA 16.

## Sorts

```json
{
  "id": "boule-de-feu",
  "nom": "Boule de feu",
  "niveau": 3,
  "ecole": "evocation",
  "portee": "45 metres",
  "composantes": "V, S, M",
  "description": "Une explosion de flammes de 6 metres de rayon.",
  "degats": { "formule": "8d6", "type": "feu" },
  "resolution": "sauvegarde",
  "sauvegarde": "dexterite",
  "cout": { "ressource": "mana", "quantite": 40 }
}
```

| Champ | Obligatoire | Valeurs |
|---|---|---|
| `id`, `nom` | oui | |
| `niveau` | oui | 0 (sort mineur) a 9 |
| `ecole` | oui | `abjuration`, `divination`, `enchantement`, `evocation`, `illusion`, `invocation`, `necromancie`, `transmutation` |
| `incantation`, `portee`, `composantes`, `duree` | non | textes libres |
| `concentration`, `rituel` | non | `true` / `false` |
| `degats` | non | `formule` et `type` |
| `soins` | non | formule de des |
| `cout` | non | cout dans une ressource facon WoW : `ressource` (`mana`, `rage`, `energie`...) et `quantite` |
| `resolution` | non | `attaque` (jet d'attaque de sort), `sauvegarde` (la cible resiste contre ton DD) ou `automatique` (touche toujours). Par defaut : `attaque` si le sort a des `degats`, sinon `automatique` |
| `sauvegarde` | non | pour `"resolution": "sauvegarde"` : la caracteristique de la cible (`dexterite`, `sagesse`...) |
| `icone`, `description` | non | comme pour les objets |

## Auras et debuffs (etats)

Les 14 conditions officielles de D&D 5e (Empoisonne, Aveugle, A terre...)
existent deja. Ajoute ici tes propres auras :

```json
{
  "id": "en-feu",
  "nom": "En feu",
  "nature": "debuff",
  "icone": "spell_fire_immolation",
  "description": "Subit 1d4 degats de feu au debut de son tour.",
  "dureeParDefaut": 3
}
```

| Champ | Obligatoire | Valeurs |
|---|---|---|
| `id`, `nom` | oui | un `id` ne peut pas reprendre celui d'une condition officielle |
| `nature` | oui | `buff` (benefique) ou `debuff` (nefaste) |
| `icone` | non | nom d'un fichier du dossier `icones/`. Par defaut : l'`id` |
| `dureeParDefaut` | non | en rounds ; sans ce champ, l'aura dure jusqu'a ce qu'on la retire |

## Monstres (le Bestiaire)

Dans le jeu, le MJ ouvre le **Bestiaire** (barre MJ) et **glisse** un monstre
sur la carte : une fiche de PNJ est fabriquee d'apres le modele, et son pion
est pose la ou on l'a lache, cache aux joueurs (clic droit > « Reveler »).
Le fichier `exemple-bestiaire.json` (commente) montre tous les champs.

```json
{
  "id": "gnoll",
  "nom": "Gnoll",
  "type": "Humanoide (gnoll)",
  "puissance": "FP 1/2",
  "pv": "5d8",
  "classeArmure": 15,
  "caracteristiques": { "force": 14, "dexterite": 12, "constitution": 11, "intelligence": 6, "sagesse": 10, "charisme": 7 },
  "attaques": [{ "nom": "Lance", "toucher": 4, "degats": "1d6+2", "type": "perforant" }],
  "butin": [{ "id": "potion-de-soins" }]
}
```

| Champ | Obligatoire | Valeurs |
|---|---|---|
| `id`, `nom` | oui | plusieurs invocations : « Gnoll », « Gnoll 2 »... |
| `pv` | oui | un nombre (`22`) ou une formule tiree a chaque invocation (`"5d8"`) |
| `classeArmure` | oui | 1 a 40 |
| `type`, `puissance`, `vitesse`, `description` | non | textes libres (affichage) |
| `niveau` | non | 1 par defaut (bonus de maitrise) |
| `rang` | non | `normal` (defaut), `elite`, `rare` ou `boss` : le cadre de cible change (dragon dore, dragon d'argent, cadre de boss) |
| `caracteristiques` | non | 10 pour chaque caracteristique absente |
| `attaques` | non | `nom`, `toucher`, `degats` (formule), `type` : affichees dans le bestiaire |
| `butin` | non | objets du compendium (`id`, `quantite`) trouves sur son cadavre |
| `taille` | non | taille du pion en cases : 1 (defaut), 2 (grande : ogre), 3, 4 (dragon) |
| `jeton` | non | image du pion, dossier `jetons/` (par defaut : l'`id`, ex. `jetons/gnoll.png`) |
| `icone` | non | image du dossier `icones/` (par defaut : l'`id`) |

Les `attaques` sont **jouables** : une fois le monstre pose, clic droit sur
son pion > « Attaques de ... » : une fenetre s'ouvre avec son portrait et ses
attaques (un clic par attaque ; elle reste ouverte pour enchainer). Ou
cible-le et passe ta barre en page 2 (elles y sont deja rangees). L'icone
d'une attaque est l'image du dossier `icones/` qui porte son nom (ex.
`icones/Morsure.png`). La fenetre de des s'ouvre : d20 + `toucher`, puis les degats
(le bonus fixe de la formule est affiche a part ; un critique ne double que
les des).

**Creer un monstre sans ouvrir de fichier** : dans le Bestiaire, bouton
**« + Nouveau monstre / PNJ »** (ou « Dupliquer pour modifier » sur un monstre
existant). Le jeu verifie chaque champ et l'ecrit dans
`compendium/mes-monstres.json` : modifiable ensuite depuis le jeu (Modifier,
Supprimer) ou au Bloc-notes, comme les autres fichiers.

Si ton compendium ne contient encore aucun monstre, le serveur y depose
`exemple-bestiaire.json` au demarrage (sans toucher a tes autres fichiers).

## Les icones et images

Depose tes images dans les dossiers de ton cloud :
`icones/` (objets, sorts, auras), `cartes/`, `jetons/`, `portraits/`.
Formats acceptes : `.png`, `.webp`, `.jpg`, `.gif`, `.svg`.

Tant qu'une image manque, un carre gris la remplace. Des que tu deposes le
fichier (par exemple `icones/epee-longue.png`), il s'affiche a la place.
