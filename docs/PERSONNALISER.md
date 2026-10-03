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
| `LifeCraft_Font.ttf` | Grands titres : ecran d'accueil, creation de personnage, annonces (police du logo de WoW) |
| `skurri.ttf` | Chiffres de combat : degats et soins sur la carte, resultat du de |

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
  **Jamais dans le dossier du projet** (celui du code) : le serveur refuse de
  demarrer, car ces images partiraient sur GitHub au prochain envoi.
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
accueille les textures de WoW (depot `Gethe/wow-ui-textures`). **Ne les renomme
pas.** Tu peux les ranger a plat ou dans leurs sous-dossiers d'origine
(`interface\Buttons\...`), et les majuscules ne comptent pas
(`UI-MINIMAP-BORDER.PNG` = `UI-Minimap-Border.png`).

Au chargement de la page, le jeu lit la liste du dossier et branche chaque
texture qu'il connait. Une texture absente ne casse rien : l'element garde son
dessin actuel. Apres avoir ajoute des fichiers : recharge la page (F5).

| Fichier(s) reconnu(s) | Ce que ca habille |
| --- | --- |
| `UI-DialogBox-Border` | Bordure metallique de toutes les fenetres et cadres |
| `UI-DialogBox-Background` | Fond des fenetres et cadres |
| `UI-DialogBox-Gold-Border` | Bordure doree de la fenetre de resolution des des |
| `UI-DialogBox-Gold-Dragon` | Dragon dans le coin de la fenetre de resolution |
| `UI-Panel-MinimizeButton-Up` / `-Down` | Bouton de fermeture (X) des fenetres |
| `UI-MicroButton-Quest-Up` / `-Down` | Micro-menu : journal de quetes (L) |
| `UI-MicroButton-LFG-Up` / `-Down` | Micro-menu : initiative (I) |
| `UI-MicroButton-EJ-Up` / `-Down` | Micro-menu : carnet de notes (N) |
| `UI-MicroButton-MainMenu-Up` / `-Down` | Micro-menu : quitter (X) |
| `UI-MicroButton-Character-Up` / `-Down` | Micro-menu : personnage (C) |
| `UI-MicroButton-Spellbook-Up` / `-Down` | Micro-menu : grimoire (P) |
| `Button-Backpack-Up` / `-Down` | Micro-menu : sacs (B) |
| `UI-MainMenuBar-EndCap-Dwarf` (sinon `-Human`) | Les griffons (sinon les lions) de la barre d'actions |
| `UI-MainMenuBar-Dwarf` (sinon `-Human`) | La barre de sorts elle-meme : ses 12 emplacements et la colonne "page" du MJ. La barre prend alors les proportions de WoW |
| `UI-Player-Portrait` | Les cadres des joueurs (en haut a gauche) : anneau du portrait, cartouche du nom, deux barres |
| `UI-Minimap-Border` | Anneau de la minicarte et cartouche du nom de la zone |
| `UI-Backpack-EmptySlot` | Cases vides du sac |
| `UI-PaperDoll-Slot-Head`, `-Neck`, `-Shoulder`, `-Chest`, `-Wrists`, `-Hands`, `-Waist`, `-Legs`, `-Feet`, `-Finger`, `-Trinket`, `-MainHand`, `-SecondaryHand` (et `-Back`, `-Shirt`, `-Tabard`, `-Ranged` si tu les ajoutes) | Silhouettes des emplacements vides de la fiche (C) |
| `ClassIcon_Warrior`, `_Paladin`, `_Hunter`, `_Rogue`, `_Priest`, `_DeathKnight`, `_Shaman`, `_Mage`, `_Warlock`, `_Monk`, `_Druid`, `_DemonHunter`, `_Evoker` | Icone de classe (fiche, creation de personnage) |
| `UI-QuestLog-BookIcon`, `Spellbook-Icon` | Medaillons du journal de quetes et du grimoire |
| `UI-QuestTitleHighlight` | Surbrillance de la quete choisie |
| `UI-QuestGreeting-TopRight` + `UI-QuestGreeting-BotRight-blank` | Cadre du parchemin du journal de quetes (le cote gauche est fabrique en miroir) |
| `QuestBackgroundClassic` | Parchemin du journal de quetes (si le cadre ci-dessus manque) |
| `Spellbook-Page-1` + `Spellbook-Page-2` | Le livre ouvert du grimoire (P) et du carnet (N) : la page 1 et son bord droit (la page 2, 32 px de large) |
| `WoWUnknownItem01` | Icone "?" pour un objet ou un sort dont l'icone manque |
| `UI-MicroButton-Raid-Up` / `-Down` (si pas de `-Character-`) | Micro-menu : personnage (C) |
| `UI-Battlefield-Icon` | Micro-menu : initiative (I) |
| `VOICECHAT-SPEAKER` | Bouton du son |
| `UI-GroupLoot-Dice-Up` / `-Down` | Bouton du lanceur de des (a cote de la discussion) |
| `LootPanel-Icon`, `INV_Misc_Book_07`, `Spell-Reset`, `INV_Misc_Map_01`, `Ability_Paladin_LightoftheProtector`, `Achievement_Quests_Completed_07`, `Spell_Nature_Sleep`, `INV_Scroll_11`, `misc_arrowleft` | Barre du MJ : bestiaire, compendium, initiative, carte, reveler, quetes, repos long, carnet, recharger |
| `UI-ChatIcon-Battlenet` / `UI-ChatIcon-Blizz` | Discussion : icone devant le nom d'un joueur / du MJ |
| `UI-ChatInputBorder-Left2` + `-Mid2` + `-Right2` | Cadre de la barre de saisie de la discussion |
| `UI-GoldIcon`, `UI-SilverIcon`, `UI-CopperIcon` | Argent du sac (1 po = 10 pa = 100 pc) |
| `Point` | Curseur de la souris (le gantelet) |
| `Hurlevents` / `Orgrimmar` | Fond de l'ecran de creation, selon la faction choisie |
| `Alliance-Logo` / `Horde-Logo` | Blasons des factions (creation) |
| `TargetFrame` | Cadre de cible (en haut, a droite des cadres du groupe) : cible normale |
| `TargetFrameElite` / `TargetFrameRare` / `UnitFrameBoss` | Cadre de cible d'un monstre elite (dragon dore), rare (dragon d'argent), boss. Le rang se choisit dans le bestiaire (champ `rang`) |
| `UI-LootPanel` | Fenetre de butin (coffres, cadavres) : medaillon, titre, bouton fermer |
| `UI-Calendar-Event-Other` (sinon `LootPanel-Icon`) | Le sac dans le medaillon de la fenetre de butin |
| `UI-Achievement-Parchment-Horizontal` | Tous les parchemins (fiche d'un monstre du bestiaire, compendium, descriptions de la creation...) |
| `UI-Achievement-StatsBackground` | Le volet des statistiques de la fiche de personnage (C), le parchemin au dragon |
| `MOTHERtalenttree` | Le ciel etoile derriere la fenetre des des (jets d'attaque, tests) |
| `Professions-Book-Left` | Le bestiaire du MJ : le livre au signet vert, et une rangee de parchemin par monstre |
| `UI-BackpackBackground` | La fenetre du sac (B) : 4 colonnes et 16 places comme dans WoW (le sac s'allonge d'une rangee si besoin), l'argent dans la bourse du bas |
| `QuestAlert` | Le bandeau noir de l'annonce "Nouvelle quete" / "Quete terminee" au centre de l'ecran |
| `UI-AbilityPanel-TopLeft` + `-TopRight` + `-BotLeft` + `-BotRight` | MJ : la fenetre des attaques d'un monstre (clic droit > Attaques) : son portrait dans le medaillon, ses attaques dans les cases (les 4 morceaux sont remis ensemble) |
| `UI-CharacterCreate-Gender` | Creation de personnage : les symboles masculin / feminin des boutons du sexe |
| `TemporaryPortrait-Male-Orc`, `TemporaryPortrait-Female-NightElf`... | Portrait par defaut selon la race et le sexe (creation, cadres des joueurs, fiche), quand le joueur n'a pas d'image dans `portraits\` |
| `QuestBackgroundClassic2` | Parchemin a l'interieur du cadre de quete |
| `UI_MainMenu_BattleForAzeroth_LowBandwidth` | Fond de l'ecran d'accueil |
| `Glues-WoW-ClassicLogo` (sinon `-WotLKLogo`) | Logo au-dessus du formulaire de connexion |
| `UI-Background-Rock` | Fond de pierre des ecrans hors jeu |

Correspondance races du referentiel -> portraits : humain = Human, nain =
Dwarf, elfe-de-la-nuit = NightElf, gnome = Gnome, draenei = Draenei, worgen =
Worgen, orc = Orc, mort-vivant = Scourge, tauren = Tauren (ou
HighmountainTauren), troll = Troll, elfe-de-sang = BloodElf, gobelin = Goblin,
pandaren = Pandaren, dracthyr = Dracthyr.

Correspondance classes du referentiel -> icones : rodeur = Hunter,
clerc = Priest, occultiste = Warlock, magicien = Mage. Barbare, barde et
ensorceleur n'ont pas d'icone de classe dans WoW : ils gardent celle du dossier
`icones/` (ou leurs initiales).

Pour ajouter un role : `client/src/core/textures.ts` (liste `ROLES`) et
`client/src/styles/textures.css`.

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
