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
│   ├── magie.js              Sorts accessibles selon le niveau, caracteristique d'incantation, DD : ecran ET serveur
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
│   │   │   ├── depot.js      Memoire du jeu + sauvegarde (fiches, tables, combats) ; met de cote les fichiers abimes
│   │   │   ├── sauvegardes.js Copies de secours datees (demarrage + chaque heure), menage, restauration
│   │   │   ├── compendium.js Lecture des fichiers du compendium, rapport d'erreurs
│   │   │   └── referentiel.js Lecture des factions, races, classes : liens verifies, rapport d'erreurs
│   │   ├── modeles/          La "forme" exacte des donnees (verifiee par Zod)
│   │   │   ├── personnage.js Fiche D&D 5e : ressources, inventaire, grimoire, etats
│   │   │   ├── compendium.js Objets, sorts, auras tels qu'ecrits dans le compendium
│   │   │   ├── referentiel.js Factions, races, classes, ressources, regles de creation
│   │   │   ├── combat.js     Ordre d'initiative et tour actif
│   │   │   ├── quete.js      Journal de quetes d'une table (titre, objectif, statut)
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
│   │   │   ├── resolution.js Jets d'attaque et de sort DETAILLES (De + Force + Maitrise = total)
│   │   │   ├── scene.js      Placer/deplacer les pions, brouillard, visibilite
│   │   │   ├── dessins.js    Traces tactiques : auteur, limites, effacement
│   │   │   └── erreurs.js    Distingue un refus normal d'un bug
│   │   └── temps-reel/       Moteur Socket.IO, un fichier par domaine
│   │       ├── index.js      Controle d'acces, salons, guichet, droits
│   │       ├── tables.js, personnages.js, repos.js
│   │       ├── referentiel.js Lecture (tous) et rechargement (MJ) du referentiel
│   │       ├── compendium.js Inventaire, grimoire, liste des images
│   │       ├── combat.js     Initiative et tours (protection double clic)
│   │       ├── resolution.js Lancer un sort, fenetre de resolution, "Valider"
│   │       ├── quetes.js     Journal de quetes : le MJ ajoute / termine, diffusion a la table
│   │       ├── chat.js       Discussion : dire, groupe, murmures (envoi cible socket par socket)
│   │       ├── sons.js       Le MJ fait jouer un son a la table
│   │       ├── joueurs.js    Expulser / readmettre un joueur (MJ)
│   │       ├── scene.js      Mouvement synchronise (saisir / glisser / lacher), brouillard
│   │       ├── tactique.js   Pings et traces tactiques (joueurs et MJ)
│   │       └── des.js
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
│       │   └── mj/           Outils du MJ (charges SEULEMENT chez le MJ) : barre MJ, bestiaire,
│       │                     compendium, fenetre carte, menu clic droit
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
├── sauvegardes/              Copies de secours des parties, 30 au plus (voir docs/SAUVEGARDES.md)
└── parties/
    ├── partie-en-cours.verrou.json   Present seulement quand un serveur tourne
    └── t-3f9a0c1b2d/                 Une table de jeu
        ├── table.json
        ├── combat.json               Present seulement pendant un combat
        ├── scene.json                Carte, grille, pions, brouillard
        ├── personnages/
        │   └── p-8e21aa04c7.json     Un fichier par personnage
        ├── corbeille/                Fiches supprimees, recuperables a la main
        └── abimes/                   Fichiers illisibles mis de cote au demarrage (jamais effaces)
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
├── .fenetres    z-index 20  sacs, fiche, grimoire, quetes (deplacables)
│                            ordre interne : la derniere fenetre cliquee passe devant
├── .couche-modale z-index 25 fenetre de resolution des des, annonce "Nouvelle quete"
├── .infobulle   z-index 30
└── .fantome     z-index 31  l'icone qui suit la souris pendant un glisser
```

Chaque couche est un « contexte d'empilement » : les `z-index` poses DANS une
couche ne la font jamais sortir. Quand on clique sur une fenetre, elle prend
un numero plus grand que les autres (`client/src/ui/Fenetre.tsx`) : elle passe
devant le grimoire ou les sacs, mais jamais devant la fenetre de resolution ni
l'infobulle. Les valeurs sont dans `theme.css` (`--z-monde` ... `--z-infobulle`).

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

## Grimoire, resolution des des, quetes, auras (sprint 8)

### Grimoire (P) et barre d'actions

Le grimoire affiche les sorts de la fiche (`grimoire`), 6 par page. Un sort
trop puissant pour le niveau du personnage est grise : le calcul
(`sortDebloque` dans `shared/magie.js`) est le meme a l'ecran et au serveur.
Le niveau de sort accessible suit D&D 5e ; les demi-lanceurs (Paladin,
Chasseur) ont `"progressionSorts": "demi"` dans `classes.json`.

Glisser un sort vers la barre reutilise **exactement** le glisser-deposer du
sprint 7 (`glisser.tsx`) : seule la « charge » transportee change
(`{ origine: "grimoire", sort }` au lieu de `{ origine: "sac", objet }`).
La case de la barre declare qu'elle accepte cette charge et enregistre le
raccourci `{ "type": "sort", "reference": "trait-de-feu" }`.

### Fenetre de resolution (facon Baldur's Gate 3)

```
joueur : clic sur la barre (ou touche 1)
   -> sort:lancer / objet:utiliser
serveur : verifie (sort connu, niveau suffisant, Mana), DEPENSE le cout,
          lance les des et detaille chaque terme ; garde le jet "en attente"
   -> reponse au joueur + jet:enCours au MJ : la fenetre s'ouvre chez les deux
joueur : "Valider" (ou Entree)   -> jet:valider
serveur -> jet:resultat a toute la table (ligne dans la discussion)
```

Anti-triche : les chiffres viennent du serveur (le navigateur ne peut que les
afficher) ; le cout est paye avant l'affichage ; le MJ voit chaque jet des
qu'il est lance ; un seul jet en attente par personnage (pas de « relance
jusqu'au 20 »). Si le joueur ferme son navigateur, le jet est valide tel quel.
Le MJ peut « Valider pour » le joueur, ou masquer sa fenetre.

Les modificateurs sont calcules depuis la fiche (`server/src/regles/resolution.js`) :
arme = d20 + caracteristique de l'arme (Force, ou Dexterite si finesse /
distance) + Maitrise ; sort = d20 + caracteristique d'incantation
(`caracteristiqueIncantation` de la classe) + Maitrise, ou un DD de
sauvegarde (8 + Maitrise + caracteristique). 20 naturel : des de degats
doubles ; 1 naturel : rate.

### Journal de quetes (L)

Le MJ ajoute une quete (fenetre L, bouton « + Nouvelle quete », ou
`/quete Titre | Objectif` dans la discussion). Le serveur
l'enregistre (`quetes.json`, dans le dossier de la table sous `parties/`) et diffuse `quetes:etat` a toute la
table : le journal se met a jour et « Nouvelle quete » s'affiche au centre de
l'ecran. Les joueurs ne peuvent que lire.

### Auras et etat « Repose »

Les auras sont les `etats` de la fiche : chaque pose ou retrait renvoie la
fiche (`personnage:maj`) et les cadres du groupe se redessinent. Le booleen
`repose` passe a `true` apres un repos long et repasse a `false` au premier
combat, sort lance, attaque, degat subi ou ressource depensee.

### Lanceur de des (bouton « d20 » a cote de la discussion)

- **Des libres** : clic sur un de = un de plus (clic droit = un de moins), un
  bonus, avantage / desavantage, une raison. Le navigateur compose seulement la
  formule (`2d6+2`, `2d20kh1`) et la demande (`des:lancer` avec `fenetre: true`) ;
  le serveur lance, la fenetre de resolution animee s'ouvre chez le joueur ET
  le MJ, et « Valider » annonce le resultat a la table. Jet secret du MJ : le
  resultat ne va qu'au MJ. La commande `/jet` reste un lancer rapide, sans
  fenetre, directement dans la discussion.
- **Tests et sauvegardes** : un bouton par caracteristique. La demande
  (`test:lancer`) ne contient QUE ce qu'on teste ; le bonus (modificateur, et
  maitrise si la classe maitrise cette sauvegarde : `maitriseSauvegardes` dans
  `classes.json`) est lu dans la fiche par le serveur, et le jet passe par la
  fenetre de resolution comme une attaque. L'avantage revient a « Normal »
  apres chaque jet.

## Discussion, sons, outils du MJ et securite (sprint 9)

### Discussion (`server/src/temps-reel/chat.js`)

| Canal | Commande | Couleur | Qui le recoit |
|---|---|---|---|
| Dire | texte simple, `/s` | blanc | toute la table (au nom du personnage) |
| Groupe | `/g` (ou `/p`) | bleu clair | toute la table (au nom du joueur, hors jeu) |
| Murmure | `/w Pseudo message`, `/w MJ ...` | rose | **les deux seuls concernes** |
| Des, annonces | (systeme) | jaune | selon le cas |

Le canal « colle » comme dans WoW (apres un `/g`, on reste en Groupe) ; un clic
sur un `[Nom]` passe en murmure vers lui. Un murmure ne passe jamais par le
salon de la table : le serveur cherche les sockets (onglets) du destinataire
et de l'expediteur et leur envoie le message **un par un**
(`io.to(socket.id)`). Les autres navigateurs ne le recoivent pas : il
n'existe ni dans leur memoire, ni dans leur trafic reseau.

### Sons (`client/src/core/audio.ts`, `server/src/temps-reel/sons.js`)

Le serveur envoie `son:jouer { son: "combat" }` ; le navigateur lit
`/medias/sons/combat` (dossier `sons/` du cloud) avec la Web Audio API, ou
fabrique un son de remplacement. Politique d'autoplay : le contexte audio est
deverrouille au premier clic / premiere touche ; avant cela, les sons sont
ignores et le bouton haut-parleur clignote.

### Ce que les joueurs ne recoivent JAMAIS

Le filtrage est fait **au depart, par le serveur** : une donnee qui n'est pas
envoyee ne peut etre ni affichee, ni lue dans les outils du navigateur (F12),
ni « sniffee » sur le reseau.

| Donnee | Protection |
|---|---|
| Fiche d'un PNJ / monstre (PV, stats) | envoyee au salon MJ seulement |
| Pion cache ou dans le brouillard | retire de la scene envoyee aux joueurs ; ses deplacements ne leur sont pas transmis |
| Monstre au combat mais invisible | anonymise : `???`, sans identifiant ni jet |
| Nom d'un monstre invisible dans une annonce | remplace par `???` (`causePourJoueurs`) |
| Jet d'un monstre invisible | automatiquement secret (MJ seul) |
| Murmure | envoye socket par socket aux deux interlocuteurs |
| Contenu d'un sac, d'un coffre | proprietaire / MJ ; coffre : a l'ouverture seulement |

Un monstre pose sur la carte arrive **cache** par defaut : le MJ le revele
(clic droit > « Reveler aux joueurs »). Le test automatique « securite : un
joueur qui ecoute TOUT le reseau... » enregistre chaque message recu par un
joueur pendant que le MJ manipule un monstre cache et verifie que ni son nom,
ni son identifiant, ni celui de son pion n'y apparaissent.

### Menu du MJ (clic droit)

Sur un cadre du groupe ou sur un pion : PV (degats, soins, fixer, PV
temporaires), poser / retirer une alteration, cacher / reveler le pion,
retirer de la carte, expulser / readmettre le joueur. Expulser : deconnexion
immediate, jetons annules, table fermee a ce pseudo jusqu'a readmission ou
redemarrage du serveur.

## Une seule interface, deux roles (sprint 10)

### Le point d'entree unique

`http://localhost:3000/` (et toute adresse qui n'est ni `/api`, ni `/medias`,
ni `/socket.io`) renvoie l'interface World of Warcraft, qui s'ouvre sur
l'ecran de connexion. L'ancienne page blanche `/test/` n'existe plus (un ancien
lien redirige vers `/`). Si l'interface n'est pas compilee, le serveur affiche
une page sombre « lance npm run partie » ; en developpement (`npm run dev`),
il renvoie vers Vite (port 5173). Le MJ entre par le lien discret « Connexion
Maitre du Jeu » de l'ecran de connexion.

### Roles : qui verifie quoi ?

**Regle d'or : l'interface ne protege rien, le serveur protege tout.** Un
joueur peut modifier n'importe quoi dans son navigateur (F12) : afficher les
boutons MJ, changer `role: "joueur"` en `"mj"` dans la memoire de la page...
Cela ne lui donne AUCUN pouvoir, pour trois raisons :

1. **Le role vit sur le serveur.** A la connexion, le serveur verifie le mot
   de passe MJ (comparaison a temps constant, 5 essais puis 15 minutes
   d'attente) et remet un jeton aleatoire de 32 octets. Le role est attache
   a ce jeton DANS LA MEMOIRE DU SERVEUR ; a chaque connexion temps reel, il
   est relu la (`socket.data.profil`). Le navigateur ne fait que montrer le
   jeton : il ne peut pas « dire » qu'il est MJ.
2. **Chaque demande MJ est verifiee.** Toute action passe par le guichet
   unique (`ctx.guichet`) et les actions MJ commencent par
   `ctx.exigerMJ(socket)` : bestiaire, carte, grille, brouillard, pions,
   combat, compendium, quetes, sons, expulsion, televersement (`/api/cartes`,
   meme verification par l'en-tete `Authorization`). Le test « roles : un
   joueur qui debloque l'interface MJ... » envoie 27 demandes MJ depuis un
   compte joueur : toutes sont refusees, et rien ne change cote serveur.
3. **Les donnees secretes ne partent jamais.** Fiches des PNJ, pions caches,
   compendium, bestiaire, jets secrets : le serveur ne les envoie qu'au salon
   du MJ. Meme une interface MJ « debloquee » chez un joueur serait vide.
   Le cadre de cible en est un exemple : pour un monstre, un joueur ne recoit
   que son nom, son niveau, son rang et sa sante ARRONDIE a 10 %
   (`santeVisible`, dans `presenterPion`), jamais ses PV exacts. Quand cette
   sante arrondie change, le serveur renvoie la scene aux joueurs
   (`publierPersonnage`). Le MJ, lui, a la fiche : il voit les PV exacts.

En plus (confort, pas securite) : le code des outils MJ est dans un fichier a
part (`client/src/jeu/mj/`), charge a la demande (`React.lazy`) seulement
quand le serveur a confirme le role MJ. Le navigateur d'un joueur ne le
telecharge meme pas.

### Les outils du MJ (dans l'interface WoW)

| Outil | Ou | Ce qu'il fait |
|---|---|---|
| Barre d'actions du MJ | en bas, page 1 (fleches ▲▼ : page 2 = barre du personnage cible) | ses outils, touches 1 a 9 : Bestiaire, Compendium, Initiative, Carte, gomme, pinceau, quetes, repos long de la table, recharger |
| Bestiaire | touche 1 | monstres du compendium ; glisser sur la carte = PNJ + pion (cache) ; coffre a glisser ; **Nouveau monstre / PNJ**, Modifier, Dupliquer, Supprimer (ecrit dans `compendium/mes-monstres.json`) |
| Compendium | touche 2 | donner un objet, apprendre un sort, poser une aura ; remplir le coffre ouvert |
| Initiative | touche 3 (et I pour tous) | combattants = pions de la carte ; lancer, reordonner (▲ ▼), modifier une valeur, tour suivant / precedent, terminer ; le pion actif pulse sur la carte de tous |
| Nom de la zone | au-dessus de la minicarte | un clic pour renommer la table |
| Coffres et cadavres | sur la carte | le MJ les glisse ailleurs (un clic sans bouger les ouvre) |
| Carte | bouton rond de la minicarte, touche 4 | televerser / choisir l'image, regler la grille, brouillard, placer les absents |
| Pinceau / gomme | touches 5 et 6, ou outils sous la minicarte | peindre / effacer le brouillard |
| Menu clic droit | pion ou cadre | PV, ressources, alterations, repos, fiche et sac, combat, cacher / reveler, cadavre, supprimer, expulser |
| Attaques d'un monstre | clic droit > Attaques | portrait et attaques du monstre ; un clic = jet d'attaque et degats (fenetre de des) |

Le glisser-deposer du Bestiaire reutilise celui des objets (sprint 7) : la
carte du jeu est simplement une nouvelle « cible » qui accepte les charges
`bestiaire` et `coffre`, et convertit le point de lacher en coordonnees de
carte (`moteur.versCarte`).

## Monstres jouables, pions illustres, carnet, repos court (sprint 11)

- **Fiches en version 6** (migration automatique au demarrage) : `attaquesMonstre`
  (copiees du bestiaire a l'invocation, et rangees sur la barre du monstre) et
  `jeton` (image du pion).
- **Attaque d'un monstre** : `monstre:attaquer` -> `jetAttaqueMonstre`
  (`server/src/regles/resolution.js`) -> fenetre de resolution, comme une arme.
  Un monstre invisible des joueurs attaque en secret (MJ seul).
- **Image du pion** : le serveur ajoute `image` a chaque pion (`jetons/<jeton>`,
  sinon le portrait) ; le moteur de carte la charge une fois et la dessine dans
  le rond, avec les initiales en secours. **Taille** : 1 a 4 cases (bestiaire,
  ou clic droit > Taille).
- **Carnet de notes** (touche N, onglet du grimoire, outil du MJ) :
  `parties/<table>/notes.json`, un carnet par auteur. Le serveur ne l'envoie
  qu'a son auteur : ni les autres joueurs, ni le MJ ne lisent le carnet d'un
  joueur.
- **Repos court** : sur la fiche (C), le joueur choisit ses des de vie ; le
  serveur les lance (1d<faces> + Constitution chacun).

### Selecteur d'icones et dossier interface (sprint 11, suite)

- `server/src/donnees/bibliotheque-icones.js` : la liste des noms du dossier
  `icones/` est lue UNE fois (asynchrone), gardee en memoire ; recherche
  multi-mots, au plus 240 resultats par reponse (`icones:chercher`, MJ ;
  `icones:actualiser` pour relire le dossier). Le navigateur ne charge que les
  vignettes visibles (`loading="lazy"`).
- Une icone choisie pour un monstre devient l'image de son pion :
  `jeton = "icones/<nom>"` (sinon `jetons/<id>`).
- Nouvelle categorie de medias `interface/` (variable `VTT_ASSETS_INTERFACE`) :
  servie avec ses sous-dossiers (`/medias/interface/Buttons/...`), express
  refusant tout chemin qui sortirait du dossier (teste).

## Textures de WoW (dossier interface/)

- `GET /api/interface` (public, `server/src/medias.js`, `creerIndexInterface`) :
  la liste des images du dossier `interface/`, sous-dossiers compris (profondeur
  4, 5000 fichiers max, fichiers caches exclus), relue au plus toutes les 10 s.
- Icone absente (`/medias/icones/<nom>`) : `WoWUnknownItem01` du dossier
  `interface/` s'il existe, sinon le carre gris. `?remplacement=non` repond
  toujours 404.
- `client/src/core/textures.ts` : table `ROLES` (role -> noms de fichiers
  candidats, insensibles a la casse). Au demarrage, chaque role trouve pose
  `--tex-<role>` et la classe `tex-<role>` sur `<html>` ; `useTexture(role)`
  pour les composants. Les textures non utilisables telles quelles sont
  recomposees dans un canvas : bordures de WoW (8 carres, bords haut/bas
  tournes) -> image 3 x 3 pour `border-image` ; anneau et cartouche de
  `UI-Minimap-Border` (anneau centre en 168,75 ; 108,3, minicarte de 140 px) ;
  surbrillances additives (noir -> transparent) ; cadre de quete (morceaux de
  droite + miroir) ; livre (Spellbook-Page-1 + -2) ; barre de sorts
  (UI-MainMenuBar-Dwarf, bandes 3 et 2, lignes 10 a 64 -> 512 x 54 ; cases a
  8 + 42 n, la taille d'un "pixel de texture" `--u` = case / 36) ; cadres
  d'unite (UI-Player-Portrait, grand cadre 193 x 76, pose en `::after`
  par-dessus le portrait et les barres places dans ses trous). Les roles a
  plusieurs fichiers listent les suivants dans `AUTRES`.
- `client/src/styles/textures.css` (charge en dernier) : toutes les regles sont
  sous `.tex-<role>` : sans fichier, le dessin CSS d'origine reste.
- Fiche : champ `sexe` ("masculin" | "feminin" | null, defaut null : pas de
  changement de version), choisi a la creation guidee. Il sert au portrait par
  defaut : role `portrait-<race>-<sexe>` (TemporaryPortrait de WoW), utilise
  quand `portraits/` n'a pas d'image pour le personnage.
- Pions des heros sur la carte : jeton, sinon portrait, sinon (option
  `imagesDeSecours` du moteur, `imagesDeRace` dans textures.ts) l'icone
  `icones/Achievement_Character_<Race>_<Male|Female>`, sinon le portrait
  provisoire ; la premiere image qui existe est dessinee, sinon les initiales.
- Icones choisies depuis le Compendium : `compendium:icone` (MJ) ecrit
  `compendium/mes-icones.json` (`{ objets: { id: icone }, sorts: {...} }`),
  lu a part a chaque chargement du compendium ; les exemplaires deja en jeu
  a la table (meme `source`) recoivent la nouvelle icone.
- Cadres du groupe : a partir de 6 heros, "raid" facon WoW (CadreRaid) : mon
  grand cadre reste, les autres en colonnes de 5 cadres compacts (vie a la
  couleur de la classe du referentiel). Si les cadres ne tiennent pas dans la
  hauteur libre, ils rapetissent (--echelle-groupe).
- Discussion : le serveur ajoute `mj: true|false` a chaque message (icone du MJ
  ou du joueur devant le nom).
- Polices : `--police-titre` (LifeCraft) et `--police-combat` (Skurri ; la
  carte demande son chargement avec `document.fonts.load`, un canvas ne le
  declenchant pas).
- Demarrage : un dossier d'assets (`VTT_ASSETS_*`) situe dans le projet est
  refuse (il partirait sur GitHub) ; `.gitignore` exclut aussi `/ICONS/`,
  `/icones/`, `/interface/`, `/polices/` a la racine, par securite.


## Combat, Actions & Sorts, incantation (sprint 11, combat)

### Regle d'or : le serveur ne retire JAMAIS de PV tout seul

Le VTT est une calculatrice visuelle. Un jet cible (`idCible`) produit :
le resultat detaille dans la discussion (`decrireJet` : « sur Gnoll
(touche) »), un texte flottant au-dessus du pion cible
(`publierTexteCombat`, seulement au MJ pour un jet secret)... et c'est tout.
Les PV changent uniquement quand le MJ clique « Retirer N PV » / « Moitie » /
« Soigner » dans la fenetre de resolution (ou son menu clic droit) :
`personnage:modifierPv` avec `sansTexte: true` (le chiffre s'est deja
affiche). Teste dans `temps-reel.test.js` (PV inchanges apres le jet).

### Cible et effet (`server/src/regles/cible.js`)

- `cibleDuJet` : la cible doit etre a la meme table ; un joueur ne peut viser
  qu'un PNJ visible (jamais un monstre cache : pas d'information secrete).
- `effetSurLaCible` : une attaque (premiere ligne = d20) touche si le total
  >= CA (1 naturel : rate ; 20 naturel : touche + critique). Le texte
  flottant prend la couleur du type de degats (`shared/types-degats.js`).
- Critique : les des de degats sont doubles (`resolution.js`).

### Emplacements de sorts (`shared/magie.js`, `regles/emplacements.js`)

- `emplacementsDuPersonnage(fiche, classe)` : table D&D 5e (complet / demi),
  max = le plus grand de la ressource et de la table ; `"pacte"` (Occultiste) :
  seulement ses ressources. Meme calcul a l'ecran et au serveur.
- `sort:lancer { niveau, idCible }` : le serveur verifie le niveau, eteint
  une gemme (`depenserEmplacement`, la ressource est creee si besoin), applique
  le renforcement (`formuleAuNiveau` + `parNiveauSuperieur`), pose l'etat
  `concentration` si le sort l'exige. Le `cout` (mana...) s'y ajoute.
- Armes et attaques de monstres : `avantage` (`desavantage|normal|avantage`).

### Interface

- `ActionsSorts.tsx` (touche P) : onglets Armes (equipement) / Mineurs /
  Niv N, lignes en accordeon, gemmes d'emplacements dans le bandeau.
- `ModaleIncantation.tsx` : confirmation avant les des (niveau d'emplacement
  ou avantage). Ouverte par la fenetre P et par la barre d'actions
  (`jeu.preparerAction`).
- Compendium MJ des sorts : `sort:enregistrer` / `sort:supprimer` (MJ) ecrivent
  `compendium/mes-sorts.json` (`donnees/compendium.js`, `modifiable`). Le nom
  d'un sort se glisse (charge `compendium-sort`) vers la fenetre P ou un
  cadre du groupe -> `grimoire:apprendre`.
- Galerie d'icones (`SelecteurIcone.tsx`) : categories par prefixe, pages de
  240 (`icones:chercher { debut }`), deplacable.
- Texte flottant (`shared/moteur-carte.js`) : couleur du texte, style `rate`,
  critique plus gros avec secousse.
