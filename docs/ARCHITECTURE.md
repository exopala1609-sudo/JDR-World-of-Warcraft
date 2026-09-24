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
│   └── dnd5e.js              Regles de base : classes, modificateurs, bonus de maitrise
│
├── server/                   Le serveur, qui tourne sur ton PC
│   ├── src/
│   │   ├── index.js          Chef d'orchestre : branche toutes les pieces et demarre
│   │   ├── config.js         Lit le .env et calcule les chemins des dossiers
│   │   ├── diagnostic.js     Verifie les dossiers au demarrage
│   │   ├── reseau.js         Affiche les adresses de connexion
│   │   ├── verrou.js         Empeche deux PC d'ouvrir la partie en meme temps
│   │   ├── fichiers.js       Ecriture "atomique" des JSON (sure avec un cloud)
│   │   ├── temps-reel.js     Moteur Socket.IO : salons, droits, arbitrage
│   │   ├── auth/
│   │   │   ├── sessions.js   Mot de passe MJ, pseudos, jetons d'acces, anti force brute
│   │   │   └── routes.js     L'adresse POST /api/connexion
│   │   ├── donnees/
│   │   │   └── depot.js      Memoire du jeu + sauvegarde des fichiers JSON
│   │   ├── modeles/          La "forme" exacte des donnees (verifiee par Zod)
│   │   │   ├── personnage.js Fiche D&D 5e complete + regles de creation
│   │   │   ├── table.js      Une session de jeu
│   │   │   ├── identifiants.js  Format des identifiants (surs comme noms de fichiers)
│   │   │   └── zod.js        Reglage de Zod (messages en francais)
│   │   └── regles/           Les arbitrages : fonctions pures, testees
│   │       ├── des.js        Lancers de des ("2d20kh1+5")
│   │       ├── points-de-vie.js  Degats, soins, PV temporaires
│   │       └── erreurs.js    Distingue un refus normal d'un bug
│   ├── public/test/          Banc de test brut du sprint 1 (HTML + JS, sans CSS)
│   └── test/                 Tests automatiques (npm test)
│
├── client/                   Future interface WoW (React), en pause pendant le sprint 1
├── scripts/                  Utilitaires (creation du .env, detection du dossier cloud)
└── docs/                     Documentation
```

## Les donnees (dans ton dossier cloud)

```
<VTT_ASSETS>/                 ex. G:\Mon Drive\JDR
├── cartes/  jetons/  portraits/  compendium/
└── parties/
    ├── partie-en-cours.verrou.json   Present seulement quand un serveur tourne
    └── t-3f9a0c1b2d/                 Une table de jeu
        ├── table.json
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
