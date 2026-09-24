# Ecrire son compendium

Le compendium est la bibliotheque du MJ : objets, sorts et auras. Ce sont de
simples fichiers texte au format JSON, ranges dans le dossier `compendium/` de
ton dossier cloud (`VTT_ASSETS`). Tu peux les ouvrir avec le Bloc-notes.

- Le serveur lit **tous** les fichiers `.json` du dossier, sous-dossiers compris.
  Range comme tu veux : `armes.json`, `sorts/mage.json`...
- Au tout premier lancement, trois fichiers `exemple-*.json` y sont deposes
  (donnees de test). Tu peux les modifier, les copier ou les supprimer.
- Apres une modification : bouton **Recharger le compendium** (inutile de
  relancer le serveur). Une erreur de saisie est signalee avec le fichier, la
  position et la raison ; les autres entrees restent utilisables.

## Squelette d'un fichier

```json
{
  "objets": [ ... ],
  "sorts": [ ... ],
  "etats": [ ... ]
}
```
Les trois listes sont facultatives. Attention aux virgules : il en faut une
entre deux entrees, et **aucune** apres la derniere.

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
| `soins` | non | formule de des, ex. `"2d4+2"` |

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

## Les icones et images

Depose tes images dans les dossiers de ton cloud :
`icones/` (objets, sorts, auras), `cartes/`, `jetons/`, `portraits/`.
Formats acceptes : `.png`, `.webp`, `.jpg`, `.gif`, `.svg`.

Tant qu'une image manque, un carre gris la remplace. Des que tu deposes le
fichier (par exemple `icones/epee-longue.png`), il s'affiche a la place.
