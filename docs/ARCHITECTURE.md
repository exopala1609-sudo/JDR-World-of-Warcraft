# Architecture : qui fait quoi

Deux mondes strictement separes :

- **Le code** vit dans le depot Git, clone sur chaque PC dans un dossier local
  (ex. `C:\Users\hadri\Documents\GitHub\`). GitHub le synchronise.
- **Les donnees** (cartes, fiches, sauvegardes) vivent dans ton dossier cloud,
  designe par `VTT_ASSETS` dans le `.env`. OneDrive / Google Drive les synchronisent.

Le code ne contient aucune donnee de jeu, les donnees ne contiennent aucun code.

## Le code

```
JDR-World-of-Warcraft/
├── .env                      Reglages de CE PC (chemin du cloud, mot de passe MJ). Jamais sur GitHub.
├── .env.exemple              Modele commente du .env.
├── package.json              Carte d'identite du projet : dependances et commandes (npm run ...).
│
├── shared/                   Code PARTAGE entre le serveur et les navigateurs
│   ├── protocole.js          Noms des messages temps reel (le "vocabulaire" commun)
│   ├── dnd5e.js              Regles de base : classes, modificateurs, ressources de depart
│   ├── raretes.js            Les 6 raretes WoW et leurs couleurs
│   ├── ressources.js         Modeles de jauges WoW (Mana, Rage, Energie, Eclats d'ame...)
│   ├── etats.js              Les 14 conditions de D&D 5e (buff / debuff + icone)
│   ├── geometrie.js          Grille, aimantation, distances, test du brouillard
│   └── moteur-carte.js       Moteur de carte Canvas (navigateur), utilise par l'interface et la page de test
│
├── server/                   Le serveur, qui tourne sur ton PC
│   ├── src/
│   │   ├── index.js          Chef d'orchestre : branche toutes les pieces et demarre
│   │   ├── config.js         Lit le .env et calcule les chemins des dossiers
│   │   ├── diagnostic.js     Verifie (et cree au besoin) les dossiers au demarrage
│   │   ├── reseau.js         Affiche les adresses de connexion
│   │   ├── tunnel.js         Acces distant en un lien (tunnel rapide Cloudflare)
│   │   ├── verrou.js         Empeche deux PC d'ouvrir la partie en meme temps
│   │   ├── fichiers.js       Lecture/ecriture sures des JSON (atomique, BOM Windows, commentaires //)
│   │   ├── medias.js         Images du dossier cloud + carre gris de remplacement
│   │   ├── auth/             Mot de passe MJ, pseudos, jetons d'acces, anti force brute
│   │   ├── donnees/
│   │   │   ├── depot.js      Memoire du jeu + sauvegarde (fiches, tables, combats)
│   │   │   ├── compendium.js Lecture des fichiers du compendium, rapport d'erreurs
│   │   │   └── referentiel.js Lecture des factions, races, classes : liens verifies, rapport d'erreurs
│   │   ├── modeles/          La "forme" exacte des donnees (verifiee par Zod)
│   │   │   ├── personnage.js Fiche D&D 5e : ressources, inventaire, grimoire, etats
│   │   │   ├── compendium.js Objets, sorts, auras tels qu'ecrits dans le compendium
│   │   │   ├── referentiel.js Factions, races, classes, ressources, regles de creation
│   │   │   ├── combat.js     Ordre d'initiative et tour actif
│   │   │   ├── scene.js      Carte, grille, pions et brouillard d'une table
│   │   │   ├── migrations.js Mise a niveau des fiches d'un ancien format
│   │   │   └── table.js, identifiants.js, zod.js
│   │   ├── regles/           Les arbitrages : fonctions pures, testees
│   │   │   ├── des.js        Lancers de des ("2d20kh1+5")
│   │   │   ├── points-de-vie.js  Degats, soins, PV temporaires
│   │   │   ├── ressources.js Depense / gain, regles de repos de chaque ressource
│   │   │   ├── repos.js      Repos court (des de vie) et repos long
│   │   │   ├── etats.js      Poser, retirer, faire expirer auras et debuffs
│   │   │   ├── combat.js     Initiative, ordre, tours et rounds
│   │   │   ├── scene.js      Placer/deplacer les pions, brouillard, visibilite
│   │   │   └── erreurs.js    Distingue un refus normal d'un bug
│   │   └── temps-reel/       Moteur Socket.IO, un fichier par domaine
│   │       ├── index.js      Controle d'acces, salons, guichet, droits
│   │       ├── tables.js, personnages.js, repos.js
│   │       ├── referentiel.js Lecture (tous) et rechargement (MJ) du referentiel
│   │       ├── compendium.js Inventaire, grimoire, liste des images
│   │       ├── combat.js     Initiative et tours (protection double clic)
│   │       ├── scene.js      Mouvement synchronise (saisir / glisser / lacher), brouillard
│   │       └── des.js
│   ├── public/test/          Banc de test brut (HTML + JS, sans CSS)
│   └── test/                 Tests automatiques (npm test)
│
├── exemples/compendium/      Donnees de test, copiees dans un compendium vide
├── exemples/referentiel/     Races, classes... PROVISOIRES, copiees dans un referentiel vide
├── client/                   L'interface World of Warcraft (React + TypeScript)
│   ├── public/interface/     Decors libres de droits (ailes de la barre d'actions)
│   └── src/
│       ├── styles/           theme.css (variables :root), base, composants, hud, fenetres, ecrans
│       ├── core/             Magasin d'etat (jeu.ts), liaison serveur, adresses des images
│       ├── ui/               Briques : surface 1440p, barre, fenetre, infobulle
│       ├── jeu/              Carte, cadres du groupe, minicarte, barre d'actions, sacs, fiche...
│       └── ecrans/           Connexion, choix de la table, ecran de jeu
├── scripts/                  Utilitaires (creation du .env, detection du dossier cloud, verification du referentiel)
└── docs/                     Documentation
```

## Les donnees (dans ton dossier cloud)

```
<VTT_ASSETS>/                 ex. G:\Mon Drive\JDR
├── cartes/  jetons/  portraits/  icones/  polices/
├── compendium/               Tes objets, sorts et auras (voir docs/COMPENDIUM.md)
├── referentiel/              Factions, races, classes, regles de creation (voir docs/REFERENTIEL.md)
└── parties/
    ├── partie-en-cours.verrou.json   Present seulement quand un serveur tourne
    └── t-3f9a0c1b2d/                 Une table de jeu
        ├── table.json
        ├── combat.json               Present seulement pendant un combat
        ├── scene.json                Carte, grille, pions, brouillard
        ├── personnages/
        │   └── p-8e21aa04c7.json     Un fichier par personnage
        └── corbeille/                Fiches supprimees, recuperables a la main
```

## Pourquoi des fichiers JSON plutot que SQLite

SQLite est une excellente base de donnees, mais sa documentation ("How To
Corrupt An SQLite Database File") cite parmi les causes de corruption la copie
du fichier pendant une ecriture, et la separation de la base de ses fichiers
journaux (`-wal`, `-journal`). C'est exactement ce que fait un outil de
synchronisation comme OneDrive ou Google Drive : la base peut arriver corrompue
sur l'autre PC.

Des petits fichiers JSON ecrits de facon atomique n'ont pas ce probleme :

| | SQLite dans le cloud | JSON (notre choix) |
|---|---|---|
| Ecriture interrompue par la synchro | risque de corruption | impossible (ecrire a cote, puis renommer) |
| Conflit entre deux PC | toute la base est touchee | une seule fiche est touchee |
| Lire / corriger une fiche a la main | outil specialise | Bloc-notes |
| Installation | module compile pour Windows | rien |

La limite du JSON (performances sur des millions d'enregistrements) ne concerne
pas une campagne de D&D : quelques centaines de fiches se chargent en quelques
millisecondes.

## Le trajet d'une action (autorite du serveur)

```
Navigateur du joueur           Serveur (ton PC)                     Tous les navigateurs de la table
────────────────────           ─────────────────                    ────────────────────────────────
"inflige 7 degats a Thrall" -> 1. jeton valide ?
                               2. demande bien formee ? (Zod)
                               3. a-t-il le droit ? (proprietaire / MJ)
                               4. regle 5e : PV temp. d'abord, min 0
                               5. enregistre la fiche (JSON)
                               6. diffuse le resultat -------------> "Thrall : 9/14 PV (par le MJ)"
<- accuse de reception (ok / refus + raison)
```

Le navigateur ne calcule jamais rien : il demande, puis affiche ce qu'il recoit.

## La carte : pourquoi un Canvas

La zone de jeu est un `<canvas>` HTML5 (dessin 2D natif), redessine jusqu'a
60 fois par seconde, en quatre calques : image, grille, pions, brouillard.

- Le brouillard est un calque de pixels que la gomme "creuse" (mode de fusion
  `destination-out`). En HTML ou SVG, il faudrait empiler des milliers de
  formes, et chaque coup de pinceau ralentirait l'affichage.
- Tout est en coordonnees de l'IMAGE de la carte : un pion en (1200, 800) est
  au meme endroit chez tout le monde, quel que soit le zoom de chacun.
- Le brouillard est stocke comme une liste de traits (gomme / pinceau), rejouee
  dans l'ordre. Le serveur sait donc calculer, sans dessiner, si un point est
  visible : c'est ce qui lui permet de ne jamais envoyer aux joueurs un monstre
  tapi dans le noir.

## Le trajet d'un pion qu'on fait glisser

```
Navigateur qui glisse            Serveur                           Autres navigateurs
─────────────────────            ───────                           ──────────────────
clic  -> "je saisis ce pion" ->  droit ? verrou libre ? -> verrou
glisser (toutes les 50 ms)   ->  verrou a lui ? -> relaie (volatile) -> le pion glisse
lacher -> position finale    ->  borne + aimante + enregistre
                                 diffuse a tous (lui compris) ------> position officielle
                                 libere le verrou
```

## L'interface : des couches superposees

```
.scene-jeu (2560 x 1440, zoom automatique si la fenetre est plus petite)
├── .monde       z-index 0   le Canvas de la carte, plein ecran
├── .hud         z-index 10  cadres fixes, disposes par une grille CSS
├── .fenetres    z-index 20  sacs, fiche de personnage (deplacables)
└── .infobulle   z-index 30
```

`.hud` et `.fenetres` couvrent tout l'ecran mais sont transparents aux clics
(`pointer-events: none`) ; seuls leurs cadres visibles les reactivent
(`pointer-events: auto`). Un clic dans le vide atteint donc la carte, un clic
sur un cadre n'y arrive jamais.
