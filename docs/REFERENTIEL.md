# Le référentiel : races, classes et règles de création

Le référentiel contient les **règles de création de personnage** sous forme de
données : factions, races, classes, ressources (Mana, Rage...) et méthode de
caractéristiques. Le code du jeu ne connaît **aucune race ni aucune classe par
son nom** : tout vient de ces fichiers.

Le livre *D&D World of Warcraft* est sorti : ses peuples, classes et dons sont
des données comme les autres. **Le projet étant public, son texte n'est jamais
mis sur GitHub** : les fichiers tirés du livre vivent seulement dans ton
dossier `referentiel/` (NAS ou cloud). Les exemples du projet, eux, ne
reprennent que le contenu libre du SRD 5.2 (voir `exemples/referentiel/LISEZ-MOI.txt`).

## À quoi il sert

C'est l'écran « Créer un personnage » qui lit le référentiel : il propose les
factions, les peuples de chaque faction (et leurs choix : lignée, nation...),
les classes (grisées quand le lore les réserve à d'autres peuples), la
spécialisation, l'historique et la méthode de caractéristiques. Le serveur revérifie chaque
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
| `historiques.json` | Historiques (règles 2024) : caractéristiques, don d'origine, compétences |
| `dons.json` | Dons : d'origine, généraux... (le texte est affiché, pas appliqué) |
| `langues.json` | Langues : table de faction où on les choisit, langues rares |
| `renommees.json` | Factions de renommée (Forgefer, Kirin Tor...) et leurs avantages par palier |
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
4. Si une partie est en cours : barre d'outils du MJ (bord droit de l'écran)
   > **Recharger**. Les joueurs reçoivent la nouvelle version immédiatement.

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
| `typeCreature` | facultatif. Défaut `Humanoide` (ex. `Dragon`, `Mort-vivant`) |
| `options` | facultatif. Choix propres au peuple (lignée, nation, taille...), 5 au plus. Voir ci-dessous |
| `renommee` | facultatif. Renommée de départ, ex. `{ "faction": "Alliance", "valeur": 3 }` |
| `donOrigineSupplementaire` | facultatif. `true` : le joueur choisit un don d'origine en plus (Humain) |
| `source` | facultatif. D'où vient l'entrée, ex. `"SRD 5.2"` ou `"Livre, p. 42"` |
| `langue` | facultatif. `id` de la langue du peuple : proposée en plus à un personnage joué hors de sa faction |
| `classesAutorisees` | facultatif, ancien format. Préfère `restrictionLore` dans la classe |

Une **option** propose plusieurs choix ; chaque choix peut changer la taille,
le type de créature, l'image (`apparence`, ex. `"elfe-de-sang"` pour
`portraits/elfe-de-sang-1.png`), la renommée, ajouter des traits, ou être
réservé à une faction :

```jsonc
"options": [
  { "id": "lignee", "nom": "Lignée", "choix": [
    { "id": "sang", "nom": "Elfe de sang", "factions": ["horde"], "apparence": "elfe-de-sang",
      "traits": [{ "nom": "...", "description": "..." }] },
    { "id": "nuit", "nom": "Elfe de la nuit", "factions": ["alliance"] }
  ] }
]
```

Un peuple sans faction propre (Pandaren, Dracthyr...) liste les deux factions ;
c'est le choix d'une option (`factions` du choix) qui peut ensuite dépendre
de la faction choisie.

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
| `classeDnd` | facultatif. Classe du Manuel des joueurs utilisée (ex. Chaman → `"Barbare"`) |
| `heroique` | facultatif. `true` : classe héroïque (niveau 3, ou accord du MJ). Simplement signalé au joueur |
| `specialisations` | facultatif. `[{ "id", "nom", "description", "sousClasse" }]` : le joueur en choisit une |
| `sousClasseCreation` | facultatif. Sous-classe obtenue dès le niveau 1 (ex. Chevalier de la mort) |
| `typeCreature` | facultatif. Remplace celui du peuple (ex. `Mort-vivant` pour le Chevalier de la mort) |
| `restrictionLore` | facultatif. Peuples autorisés par le lore, voir ci-dessous |
| `renommee` | facultatif. Renommée gagnée en prenant la classe, ex. Mage : `{ "faction": "kirin-tor", "valeur": 3 }` |

La **restriction de lore** liste les peuples (et, si besoin, les choix
d'option) qui ont accès à la classe. Le MJ peut la lever pour sa table avec
l'outil **⚑ Lore libre** : le joueur voit alors une case « Ignorer les
restrictions de lore ».

```jsonc
"restrictionLore": {
  "peuples": [{ "race": "elfe", "choix": ["sang", "nuit"] }, { "race": "dracthyr" }],
  "message": "Lore : réservé aux elfes de sang et de la nuit."
}
```

### Historique

| Champ | Valeurs |
|---|---|
| `id`, `nom`, `description` | |
| `caracteristiques` | les 3 caractéristiques où placer +2/+1 ou +1/+1/+1 |
| `donOrigine` | `id` d'un don de catégorie `origine` |
| `competences` | facultatif. Liste de textes |
| `outil`, `equipement` | facultatif. Textes |
| `source` | facultatif |

Dès qu'au moins un historique existe, **le joueur doit en choisir un**.

### Langue

| Champ | Valeurs |
|---|---|
| `id`, `nom` | |
| `description` | facultatif |
| `tables` | factions dont la table la propose à la création, ex. `["alliance"]` |
| `rare` | facultatif. `true` : seulement donnée en jeu par le MJ |
| `conseillee` | facultatif. `true` pour le Commun et l'Orc (le jeu le conseille) |

À la création, le joueur choisit `languesAuChoix` langues (3 par défaut) dans
la table de sa faction. Un peuple sans faction (Dracthyr sans weyrn de camp...)
choisit dans les deux tables. Un personnage joué hors de sa faction (lore
libre) peut aussi prendre la `langue` de son peuple.

### Faction de renommée

| Champ | Valeurs |
|---|---|
| `id`, `nom` | |
| `faction` | son camp : `alliance`, `horde`, ou `null` pour une faction neutre |
| `description` | facultatif |
| `avantages` | facultatif. `[{ "palier": "honore", "nom": "...", "description": "..." }]` |

La renommée de départ d'un personnage additionne celle de son peuple (ou de
son choix de lignée, weyrn...) et celle de sa classe. **Hors de sa faction**,
la faction de camp de son peuple part à `renommeeHorsFaction` (−3 : Hostile).
En jeu, seul le MJ la change (fiche du personnage, touche C). Les paliers
(`paliersRenommee`, dans `creation`) sont ceux de WoW : Hostile (moins de 0),
Neutre (0), Amical (3), Honoré (10), Révéré (25), Exalté (50).

### Don

| Champ | Valeurs |
|---|---|
| `id`, `nom`, `description` | |
| `categorie` | `origine`, `general`, `style-de-combat` ou `faveur-epique` |
| `races` | facultatif. Réservé à ces peuples (ex. les dons humains du livre) |
| `source` | facultatif |

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
| `methodes` | `["tableau-standard", "achat-de-points", "tirage-4d6"]`. À chaque table, le MJ choisit en plus lesquelles il permet (outil **⚅ Création**) |
| `tableauStandard` | `[15, 14, 13, 12, 10, 8]` (exactement 6 valeurs) |
| `achatDePoints` | budget `27`, coûts `8`→0 ... `13`→5, `14`→7, `15`→9 (sans trou) |
| `caracteristiqueMaximale` | `20`, plafond après bonus de race |

**Tirage aux dés (`tirage-4d6`)** : le serveur lance six fois 4d6 et garde
les 3 meilleurs dés ; toute la table voit le résultat dans la discussion. Le
joueur répartit ses six valeurs comme il veut. Il a **2 relances**
offertes ; au-delà, le MJ en accorde d'autres (fenêtre **⚅ Création**).
Recharger la page ne donne pas de relance. Le joueur garde toujours son
**meilleur** tirage (le total le plus haut).
| `restrictionsRaceClasse` | `true`. `false` = plus aucune restriction de lore, pour toutes les tables |
| `languesAuChoix` | `3` : langues choisies à la création |
| `renommeeHorsFaction` | `-3` : renommée de départ auprès de la faction de son peuple, joué hors de sa faction |
| `paliersRenommee` | les 6 paliers de WoW (voir « Faction de renommée ») |

## Vérifications automatiques

En plus de la forme de chaque entrée, le serveur vérifie les **liens** :

- une race qui cite une faction inconnue est signalée (et ignorée si elle
  n'a plus aucune faction) ;
- une classe inconnue dans `classesAutorisees` est signalée et retirée ;
- un peuple inconnu dans une `restrictionLore` est signalé et retiré ;
- une faction de renommée, une langue ou un palier inconnus sont signalés
  et ignorés ;
- un historique dont le don d'origine manque, ou n'est pas un don
  d'origine, est signalé ;
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
  restrictions, bonus d'historique. Les dons, compétences et outils sont
  enregistrés et affichés, mais leurs effets ne sont pas encore calculés.
- Les fichiers d'exemple ne sont copiés qu'**une fois**, dans un dossier vide.
  Le jeu n'écrase jamais tes modifications. Les modèles d'origine restent dans
  `exemples/referentiel/` du projet.
