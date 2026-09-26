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
│   ├── couleurs.js           Couleur de chaque joueur (pions, traces, pings), palette des traces
│   ├── creation.js           Regles de creation (achat de points, bonus de race, PV, CA), ecran ET serveur
│   ├── equipement.js         Emplacements, CA selon l'equipement, attaques, raccourcis : ecran ET serveur
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
│   │   │   ├── dessins.js    Traces tactiques : auteur, limites, effacement
│   │   │   └── erreurs.js    Distingue un refus normal d'un bug
│   │   └── temps-reel/       Moteur Socket.IO, un fichier par domaine
│   │       ├── index.js      Controle d'acces, salons, guichet, droits
│   │       ├── tables.js, personnages.js, repos.js
│   │       ├── referentiel.js Lecture (tous) et rechargement (MJ) du referentiel
│   │       ├── compendium.js Inventaire, grimoire, liste des images
│   │       ├── combat.js     Initiative et tours (protection double clic)
│   │       ├── scene.js      Mouvement synchronise (saisir / glisser / lacher), brouillard
│   │       ├── tactique.js   Pings et traces tactiques (joueurs et MJ)
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
│       └── ecrans/           Connexion, choix de la table, creation du personnage, ecran de jeu
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

## La carte interactive (sprint 5)

### Qui recoit le clic ?

L'ecran de jeu est un empilement de couches. Le Canvas de la carte est **au
fond** ; les cadres de l'interface (groupe, minicarte, barres, fenetres) sont
au-dessus, dans des couches « transparentes aux clics » (`pointer-events:
none`) dont seuls les cadres visibles captent la souris. Un clic sur un cadre
s'arrete donc au cadre ; un clic dans le vide traverse jusqu'a la carte.

Une fois un geste commence sur la carte (glisser un pion, tracer), le Canvas
« capture » la souris (`setPointerCapture`) : on peut passer au-dessus d'un
cadre ou y relacher le bouton, le geste se termine normalement.

### Ordre de dessin du Canvas

1. image de la carte, 2. grille, 3. pions des monstres, 4. brouillard,
5. traces tactiques, 6. pions des joueurs (le groupe se voit toujours, meme
dans le noir), 7. effets animes : pings et textes de combat. Les effets sont
dessines en pixels d'ECRAN : ils gardent la meme taille quel que soit le zoom.

### Securite des deplacements

| Protection | Ou |
|---|---|
| Identite : le role et le pseudo viennent du jeton de connexion, jamais du message | `auth/sessions.js` |
| Un joueur ne saisit que le pion de SON personnage ; le MJ, tous | `temps-reel/scene.js` (`exigerDroitDeDeplacer`) |
| Verrou : deux personnes ne tirent jamais le meme pion | `temps-reel/scene.js` |
| Position finale calculee par le serveur : bornee a la carte, aimantee a la grille | `regles/scene.js` |
| Un monstre dans le brouillard n'est jamais envoye aux joueurs (ni sa position, ni ses chiffres de degats) | `regles/scene.js`, `publierTexteCombat` |
| Quotas anti-inondation : 40 positions / s, 3 pings / s, 40 morceaux de trace / s | `ctx.quota` |

Non gere a ce jour : la limite de distance par tour (vitesse) et l'obligation
de ne bouger que pendant son tour de combat.

### Textes de combat flottants

Chaque changement de PV (degats, soins, repos) produit, cote serveur, un
message `combat:texte` : `{ idPersonnage, genre, montant, critique, absorbe }`.
Seul un montant voyage : jamais les PV restants d'un monstre. Couleurs :
blanc (degats), gros jaune (critique), vert (soins).

## La premiere connexion (sprint 6)

### Le parcours

```
Connexion --> Choix de la table --+--> (MJ, ou joueur qui a deja son personnage) --> Jeu
                                  |
                                  +--> (joueur sans personnage a cette table) --> Creation --> Jeu
```

### Qui decide ? Le serveur.

Au moment ou le joueur choisit une table (`table:rejoindre`), le serveur
regarde s'il possede un personnage a cette table :

- **oui** : il le fait entrer dans les salons de la table et lui renvoie la
  photo complete (fiches, carte, combat, traces) ;
- **non** : il le laisse **a la porte**. Il ne rejoint aucun salon et ne
  recoit ni la carte, ni les fiches, ni les degats. Il ne peut ni pinguer ni
  tracer. Le serveur repond seulement `creationRequise: true`.

L'ecran de creation envoie des **choix** (`creation:valider`) : race, classe,
methode, caracteristiques de base, portrait, nom. Le serveur verifie tout
d'apres le referentiel (faction de la race, restriction de classe, tableau
standard ou budget de points, portrait existant), applique les bonus de race,
calcule PV, CA et ressources, enregistre la fiche, **pose le pion** sur une
case libre pres des autres heros, puis fait entrer le joueur en jeu. Il
renvoie la meme photo complete qu'un `table:rejoindre`.

### Cote navigateur (le magasin d'etat)

Un seul magasin (`core/jeu.ts`) pilote l'ecran affiche (`App.tsx`) :

| Etat du magasin | Ecran |
|---|---|
| pas de `profil` | Connexion |
| `profil`, pas de `table` | Choix de la table |
| `table` et `creationRequise` | Creation du personnage |
| `table` sans `creationRequise` | Jeu |

Les choix en cours de l'ecran de creation (race, classe, scores) restent
**locaux a cet ecran** : ils ne concernent personne d'autre tant que le joueur
n'a pas valide. Au succes, le magasin recoit la photo de la table et passe
`creationRequise` a `false` : React affiche aussitot l'ecran de jeu. Il n'y a
ni rechargement de page ni nouveau jeton : la connexion Socket.IO ouverte a
la connexion reste la meme, le serveur l'a simplement ajoutee aux salons.

Apres un F5, la session reprend (`sessionStorage`) et redemande la table : le
serveur renvoie la creation tant que le personnage n'existe pas.

### Un seul calcul, des deux cotes

`shared/creation.js` contient les regles de creation (achat de points,
tableau standard, bonus de race, PV, CA, ressources). L'ecran s'en sert pour
l'apercu en direct, le serveur pour arbitrer : ce que le joueur voit est
exactement ce qui sera enregistre.

## Equipement, barre d'actions et butin (sprint 7)

### Le glisser-deposer des objets (`client/src/ui/glisser.tsx`)

Pas d'API « Drag & Drop » HTML5 : le navigateur y impose son image et son
curseur, et perd le fil si l'on lache hors de la fenetre. On utilise les
**Pointer Events** et la **capture du pointeur** :

1. appui sur un objet : rien tant que la souris n'a pas bouge de 5 px (un clic
   reste un clic) ; le glisser natif des images est bloque ;
2. au-dela, l'element capture le pointeur (`setPointerCapture`) : il recoit
   tous les mouvements et le relachement, meme au-dessus de la carte ou hors
   du navigateur. **Le Canvas ne recoit rien** : pas de pion ni de vue deplaces ;
3. une icone « fantome » suit la souris, dans une couche transparente aux clics ;
4. au relachement, `document.elementsFromPoint` trouve la cible (`data-cible`).
   Si elle accepte l'objet, elle le recoit ; sinon (vide, hors fenetre, Echap,
   Alt+Tab) le glisser est annule et l'objet reste en place.

Pendant un glisser, les cases qui peuvent recevoir l'objet s'eclairent en
vert, celle survolee en or. Le calcul (`peutAllerDans`) est dans
`shared/equipement.js`, le meme que celui du serveur.

### Le serveur arbitre

| Demande | Verifications | Effet |
|---|---|---|
| `equipement:equiper` | proprietaire ou MJ, objet dans CE sac, emplacement compatible | l'objet quitte le sac ; l'ancien (et une arme a deux mains en conflit) y retourne ; CA recalculee |
| `equipement:desequiper` | proprietaire ou MJ | retour au sac, CA recalculee |
| `barre:definir` | l'objet existe et s'utilise (arme, soins) | raccourci enregistre dans la fiche |
| `objet:utiliser` | proprietaire ou MJ | potion : soins lances par le serveur, une de moins ; arme equipee : jets d'attaque et de degats pour toute la table |
| `butin:ouvrir` / `butin:prendre` | butin visible, pion a 2 cases au plus | l'objet quitte le butin et entre dans le sac |

**Pas de double pillage** : Node.js traite les demandes une par une. Le premier
« prendre » retire l'objet ; le second, meme envoye au meme instant, trouve la
place vide et recoit un refus. Les fenetres de butin ouvertes chez les autres
se mettent a jour en direct (`butin:maj`).

**Ce que voient les joueurs** : sur la carte, un coffre ou un cadavre (et s'il
est vide), jamais son contenu. Le contenu n'est envoye qu'a l'ouverture, a
cote du coffre. Les butins dans le brouillard ne sont pas envoyes du tout.
