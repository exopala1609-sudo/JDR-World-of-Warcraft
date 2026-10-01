# Le référentiel : races, classes et règles de création

Le référentiel contient les **règles de création de personnage** sous forme de
données : factions, races, classes, ressources (Mana, Rage...) et méthode de
caractéristiques. Le code du jeu ne connaît **aucune race ni aucune classe par
son nom** : tout vient de ces fichiers.

Objectif : à la sortie du livre *D&D World of Warcraft*, tu remplaces les
données provisoires par les vraies, **au Bloc-notes**, sans toucher au code.

## À quoi il sert

C'est l'écran « Créer un personnage » qui lit le référentiel : il propose les
factions, les races de chaque faction, les classes (grisées quand la race n'y
a pas accès) et la méthode de caractéristiques. Le serveur revérifie chaque
choix avec ces mêmes fichiers. Les portraits et les icônes de l'écran sont
décrits dans `docs/PERSONNALISER.md`.

## Où sont les fichiers ?

Dans le dossier `referentiel/` de ton dossier cloud (`VTT_ASSETS`), par exemple
`G:\Mon Drive\JDR\referentiel\`. Au premier lancement, le serveur y copie les
modèles du projet (`exemples/referentiel/`), avec un `LISEZ-MOI.txt`.

| Fichier | Contenu |
|---|---|
| `factions.json` | Alliance, Horde : nom, description, couleur, emblème |
| `races.json` | Faction(s), bonus de caractéristiques, vitesse, traits, **classes autorisées** |
| `classes.json` | Dé de vie, défense sans armure, ressources de départ, couleur |
| `ressources.json` | Jauges et compteurs : maximum, départ plein/vide, règles de repos |
| `creation.json` | Tableau standard, achat de points, plafond, restrictions on/off |

Ce découpage n'est qu'une convention : le serveur lit **tous** les `.json` du
dossier (sous-dossiers compris). Tu peux par exemple ajouter
`races-du-livre.json` à côté des autres.

Autre dossier que celui du cloud : `VTT_ASSETS_REFERENTIEL=...` dans le `.env`.

## Modifier un fichier, pas à pas

1. Clic droit sur le fichier > **Ouvrir avec** > **Bloc-notes**.
2. Modifie, puis enregistre (`Ctrl + S`).
3. Vérifie, sans lancer le serveur. Dans l'Invite de commandes :
   ```bat
   cd C:\Users\hadri\Documents\GitHub\JDR-World-of-Warcraft
   npm run verifier-referentiel
   ```
   Tu obtiens la liste des races par faction et des classes, puis
   `[ OK ] Aucune erreur.` ou la liste précise des erreurs.
4. Si une partie est en cours : outils du MJ (`/test/`) > **Recharger le
   référentiel**. Les joueurs reçoivent la nouvelle version immédiatement.

## Ce que le format accepte

C'est du JSON, avec deux libertés en plus pour une saisie à la main :

- **les commentaires** : tout ce qui suit `//` sur une ligne est ignoré ;
- **une virgule en trop** après le dernier élément d'une liste est tolérée.

Une faute de frappe est signalée avec **le fichier, la ligne, la colonne** et un
conseil. L'entrée fautive est ignorée ; tout le reste fonctionne.

## Les quatre règles d'or

1. **Ne change jamais un `id`** une fois des personnages créés : leurs fiches
   l'enregistrent. Pour renommer, change seulement `nom`. C'est ainsi que la
   classe `roublard` s'affiche « Voleur ».
2. Textes entre guillemets **droits** `"..."`, jamais courbes `“...”`.
3. Une virgule entre deux éléments.
4. Avant une grosse modification, garde une copie en `.txt` (une copie en
   `.json` serait lue en double).

## Référence des champs

Les champs non marqués « facultatif » sont obligatoires. Les caractéristiques
s'écrivent `force`, `dexterite`, `constitution`, `intelligence`, `sagesse`,
`charisme`.

### Faction

| Champ | Valeurs |
|---|---|
| `id`, `nom` | |
| `description` | facultatif |
| `embleme` | facultatif. Image de `icones/`, sans extension. Par défaut `faction-<id>` |
| `couleur` | facultatif. `#RRVVBB` |

### Race

| Champ | Valeurs |
|---|---|
| `id`, `nom`, `description` | |
| `factions` | liste d'`id` de factions, ex. `["alliance", "horde"]` |
| `icone` | facultatif. Par défaut `race-<id>` |
| `taille` | facultatif. `petite`, `moyenne` (défaut), `grande` |
| `vitesse` | facultatif. En mètres, par pas de 1,5. Défaut `9` |
| `bonusCaracteristiques` | bonus fixes (règles 2014), ex. `{ "constitution": 2, "force": 1 }` |
| `bonusAuChoix` | facultatif (règles 2024). `{ "bonus": [2, 1], "parmi": "toutes" }` : le joueur répartit +2 et +1 sur deux caractéristiques différentes |
| `pvParNiveau` | facultatif. PV en plus par niveau (ex. robustesse naine). Défaut `0` |
| `langues` | facultatif. Liste de textes |
| `traits` | facultatif. `[{ "nom": "...", "description": "..." }]`. Affichés, pas appliqués automatiquement |
| `classesAutorisees` | `"toutes"` ou liste d'`id` de classes |

### Classe

| Champ | Valeurs |
|---|---|
| `id`, `nom`, `description` | |
| `equivalentDnd` | facultatif. Nom de la classe D&D d'origine, pour mémoire |
| `icone` | facultatif. Par défaut `classe-<id>` |
| `couleur` | facultatif. `#RRVVBB` |
| `deDeVie` | `6`, `8`, `10` ou `12` |
| `caracteristiquesPrincipales` | facultatif. Conseil affiché au joueur |
| `defenseSansArmure` | facultatif. Caractéristiques ajoutées à la CA sans armure (10 + DEX + ...), ex. `["sagesse"]` |
| `maitriseSauvegardes` | facultatif. Jets de sauvegarde maîtrisés (bonus de maîtrise ajouté), ex. `["force", "constitution"]` pour le Guerrier |
| `caracteristiqueIncantation` | facultatif. Caractéristique des sorts (attaque de sort, DD), ex. `"intelligence"` pour le Mage. Par défaut : la première caractéristique principale parmi Intelligence, Sagesse, Charisme |
| `progressionSorts` | facultatif. `"complete"` (par défaut) ou `"demi"` (Paladin, Chasseur : les niveaux de sorts arrivent deux fois moins vite) |
| `ressources` | facultatif. Ressources de départ, voir ci-dessous |

Une ressource de départ cite un modèle de `ressources.json`, et peut en changer
le maximum ou les règles de repos :

```jsonc
{ "ressource": "mana" }
{ "ressource": "emplacements-niveau-1", "max": 1, "reposCourt": "remplir" }
{ "ressource": "inspiration-bardique", "max": { "modificateur": "charisme", "minimum": 1 } }
```

### Ressource

| Champ | Valeurs |
|---|---|
| `id`, `nom` | |
| `type` | `jauge` (barre) ou `compteur` (cases) |
| `max` | 0 à 999 |
| `depart` | facultatif. `plein` (défaut) ou `vide` |
| `reposCourt`, `reposLong` | `remplir`, `vider`, `moitie`, `aucun`, ou `{ "ajouter": 2 }` |
| `couleur` | facultatif. Couleur de la barre, `#RRVVBB` |
| `description` | facultatif |

### Règles de création (`creation`)

Une seule définition dans tout le dossier. Si elle manque ou est fausse, les
règles **officielles de D&D 5e** s'appliquent.

| Champ | Défaut (officiel) |
|---|---|
| `methodes` | `["tableau-standard", "achat-de-points"]` |
| `tableauStandard` | `[15, 14, 13, 12, 10, 8]` (exactement 6 valeurs) |
| `achatDePoints` | budget `27`, coûts `8`→0 ... `13`→5, `14`→7, `15`→9 (sans trou) |
| `caracteristiqueMaximale` | `20`, plafond après bonus de race |
| `restrictionsRaceClasse` | `true`. `false` = toutes les races ont accès à toutes les classes |

## Vérifications automatiques

En plus de la forme de chaque entrée, le serveur vérifie les **liens** :

- une race qui cite une faction inconnue est signalée (et ignorée si elle
  n'a plus aucune faction) ;
- une classe inconnue dans `classesAutorisees` est signalée et retirée ;
- une ressource inconnue dans une classe est signalée et retirée ;
- un dossier sans faction, race ou classe valide est signalé : la création de
  personnage serait impossible.

Une entrée déjà signalée comme fautive ne provoque pas d'erreurs en cascade
ailleurs : corrige la première erreur de la liste, puis revérifie.

## Limites à connaître

- Les **traits** raciaux sont du texte : le jeu les affiche, il ne les applique
  pas (comme les états).
- Le format couvre tout ce que le serveur **calcule** aujourd'hui : bonus de
  caractéristiques, PV, CA sans armure, vitesse, ressources de départ,
  restrictions. Si le livre introduit une mécanique nouvelle (maîtrises de
  jets de sauvegarde, compétences, historiques...), il faudra un ajout de code
  pour la calculer. Les données existantes, elles, resteront valables.
- Les fichiers d'exemple ne sont copiés qu'**une fois**, dans un dossier vide.
  Le jeu n'écrase jamais tes modifications. Les modèles d'origine restent dans
  `exemples/referentiel/` du projet.
