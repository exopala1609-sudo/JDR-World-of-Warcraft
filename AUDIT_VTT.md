# Audit du VTT « World of Warcraft » — 14 novembre 2026

## Résumé (10 lignes)

1. Le code est **sain dans sa conception** : le serveur décide de tout, chaque message est contrôlé, 161 tests automatiques passent, la compilation passe.
2. **Problème n°1 : le travail est éparpillé sur 6 branches.** La branche par défaut de GitHub s'arrête au « Sprint 4 » ; la version la plus avancée (Sprint 11, 30 modifications plus loin) et le travail « NAS » sont ailleurs, non réunis. Un `git pull` aujourd'hui ramène une vieille version.
3. **Problème n°2 : un joueur n'a pas de mot de passe.** Taper le pseudo d'un autre suffit pour prendre son personnage, son sac et ses notes privées. Vérifié par un essai réel.
4. **Problème n°3 : aucune sauvegarde de secours.** Un fichier de carte, de quêtes ou de notes devenu illisible est ignoré puis **écrasé par un fichier vide**.
5. Le brouillard de guerre cache bien les monstres, mais **pas l'image de la carte** : elle est téléchargeable par n'importe qui, sans connexion.
6. Les règles de D&D 5e sont codées en dur dans environ 27 fichiers : à isoler avant d'intégrer le livre officiel.
7. **Le DS218play peut très probablement faire tourner le projet sans Docker** (serveur mesuré à ~100 Mo de mémoire), mais 3 points sont à contrôler sur le NAS lui-même.
8. Accès distant recommandé : **tunnel Cloudflare + nom de domaine (~10 €/an) + filtre par e-mail**. Aucun port ouvert sur la box.
9. L'interface est inutilisable sur téléphone et aucune musique d'ambiance n'existe : ce sont les deux plus gros manques côté immersion/confort.
10. Rien n'a été modifié. La phase 3 attend tes réponses aux questions en fin de document.

---

## Comment lire ce document

- **Ce que j'ai fait** : lu le code, lancé les tests et la compilation, et démarré le serveur **sur une copie temporaire hors de ton projet** pour mesurer et vérifier. Aucun fichier du projet n'a été modifié (sauf l'ajout de ce rapport), rien n'a été déployé, rien n'a touché ton NAS ni ton réseau.
- **Ce que je n'ai pas pu faire** : voir l'interface avec tes images de WoW (elles ne sont pas dans le dépôt, c'est normal) ; consulter le site officiel de Synology et celui de Tailscale (bloqués depuis mon environnement). Tout ce qui en dépend est marqué **« à vérifier »**.
- **Effort** : *petit* = une séance de travail ; *moyen* = quelques séances ; *gros* = un chantier en plusieurs lots.

### Petit lexique (termes utilisés plus bas)

| Terme | Signification |
|---|---|
| **Dépôt** | Le dossier du projet tel que GitHub le conserve, avec tout son historique. |
| **Branche** | Une copie parallèle du projet, pour travailler sans toucher à la version principale. |
| **Fusionner** | Réunir deux branches en une seule. |
| **Pull** (`git pull`) | Récupérer sur une machine la dernière version présente sur GitHub. |
| **Serveur** | Le programme qui tourne chez toi (PC ou NAS) et auquel les navigateurs se connectent. |
| **Client** | La partie qui s'affiche dans le navigateur de chaque participant. |
| **Temps réel** | Un « tuyau » qui reste ouvert entre le navigateur et le serveur, pour que tout le monde voie un pion bouger immédiatement. La technique utilisée s'appelle *WebSocket* (via l'outil *Socket.IO*). |
| **Jeton** | Un bracelet de festival numérique : on le reçoit à l'entrée, on le montre ensuite au lieu de redonner son mot de passe. |
| **Node.js** | Le moteur qui fait tourner le serveur. Sans lui, rien ne démarre. |
| **Compiler / build** | Transformer le code de l'interface en fichiers prêts à être envoyés aux navigateurs. |
| **Docker** | Un système de « boîtes » isolées pour installer un logiciel. Ton NAS ne le propose pas officiellement ; on s'en passe. |
| **Tunnel** | Une connexion que ton NAS ouvre *vers l'extérieur* ; les joueurs passent par elle. Rien n'est ouvert sur ta box. |
| **Port** | Une « porte numérotée » d'une machine. Ouvrir un port sur la box = laisser Internet frapper à cette porte. |
| **HTTPS** | La version chiffrée du web (le cadenas du navigateur). |
| **SSH** | Une fenêtre de commandes à distance sur le NAS. |
| **JSON** | Un format de fichier texte dans lequel le jeu range ses données (fiches, carte, quêtes). |
| **Migration** | Un petit programme qui convertit d'anciennes sauvegardes au nouveau format. |

---

# PHASE 1 — AUDIT DU CODE

## 1.1 Résultat du `git pull` et état du dépôt

Le `git pull` n'a rien ramené de nouveau sur la branche où je travaille. **Mais il a révélé le problème d'organisation le plus important du projet** :

| Branche sur GitHub | Contenu | Remarque |
|---|---|---|
| `claude/gifted-einstein-jd6x5g` | Sprint 4 (24 septembre) | **C'est la branche par défaut** : celle qu'on obtient en téléchargeant le projet. |
| `claude/nifty-heisenberg-16rhf2` | **Sprint 11** (5 octobre), 30 modifications de plus | La vraie version actuelle. Contient déjà la fusion de `peaceful-mendel`. |
| `hebergement-nas` | Guide Synology, tunnel permanent, code de table | Partie du Sprint 4. **Jamais réunie** avec le Sprint 11 ; les mêmes fichiers ont changé des deux côtés. |
| `claude/add-claude-md` | Un fichier de consignes | Non réuni. |
| `claude/peaceful-mendel-iykort` | Correctif d'affichage | Déjà inclus dans le Sprint 11. |

Il n'existe **pas de branche `main`** (le nom habituel de la version de référence).

**Supposition (à vérifier)** : j'ai considéré que le Sprint 11 est ta version de travail, et **c'est elle que j'ai auditée**, plus la branche `hebergement-nas`.

## 1.2 Ce que fait le projet

Une table de jeu virtuelle dans le navigateur, habillée comme l'interface de World of Warcraft, avec aujourd'hui les règles de D&D 5e. Le MJ lance un programme ; les joueurs ouvrent un lien, tapent un pseudo, créent leur personnage et jouent.

Fonctions présentes (Sprint 11) : carte avec grille, pions, brouillard de guerre, pings et dessins tactiques ; fiches de personnage, sacs, équipement, grimoire, barre d'actions ; lanceur de dés animé ; combat et initiative ; butins (coffres, cadavres) ; journal de quêtes ; carnet de notes privé ; discussion avec murmures ; bruitages ; bestiaire et compendium (catalogue d'objets, sorts, monstres) pour le MJ ; écran de création de personnage.

## 1.3 Organisation

```
server/   le serveur (Node.js)
  auth/        qui a le droit d'entrer (jetons, mot de passe MJ)
  donnees/     lecture/écriture des sauvegardes
  modeles/     la « forme » exacte de chaque donnée (fiche, carte, combat…)
  regles/      les règles du jeu, sous forme de calculs testés
  temps-reel/  un fichier par domaine (carte, combat, dés, discussion…)
client/   l'interface (React + TypeScript), ~14 000 lignes dont 5 500 de mise en forme
shared/   le code commun au serveur et au navigateur (règles D&D, moteur de carte)
docs/     5 guides en français
exemples/ fichiers modèles (races, classes, objets, sorts, monstres)
```

Taille : environ 28 000 lignes. Les données de jeu (parties, images) vivent **hors du projet**, dans un dossier désigné par le fichier de réglages `.env`.

## 1.4 Forces — à garder absolument

1. **Le serveur est le seul arbitre.** Un navigateur ne dit jamais « j'ai fait 20 » : il demande, le serveur lance les dés, vérifie les droits, enregistre et diffuse. C'est la bonne base contre la triche.
2. **Chaque message est contrôlé** à l'entrée par un « guichet » unique (bibliothèque Zod) : forme, taille, valeurs. Un message bizarre est refusé proprement.
3. **Les monstres cachés ne quittent jamais le serveur.** Pions cachés ou dans le brouillard, noms dans l'ordre d'initiative (« ??? »), chiffres de dégâts : tout est filtré avant envoi. J'ai relu ce code, il est cohérent.
4. **Sac privé, murmures et carnet réellement privés** : envoyés uniquement aux écrans concernés.
5. **Écriture « atomique »** : on écrit à côté puis on renomme, donc jamais de fichier à moitié écrit en cas de coupure.
6. **Un fichier par personnage**, corbeille au lieu de suppression, et migrations pour les anciennes fiches.
7. **161 tests automatiques, tous réussis** ; la compilation de l'interface passe sans erreur (vérifié).
8. **Races, classes et ressources sont déjà des fichiers de données** modifiables sans toucher au code, avec des messages d'erreur clairs en français. C'est exactement la bonne direction pour le livre officiel.
9. **Garde-fous existants** : mot de passe MJ comparé sans fuite d'information, blocage après 5 essais, limite anti-inondation sur la discussion et les pings, images téléversées vérifiées sur leur contenu réel.
10. **Peu de dépendances** (3 bibliothèques principales) : c'est ce qui rend possible une installation sur le NAS sans Docker.
11. Code et documentation en français, abondamment commentés.

## 1.5 Faiblesses et risques

### CRITIQUE

| # | Problème | Conséquence concrète | Effort |
|---|---|---|---|
| C1 | **Branches non réunies, pas de `main`.** | Un `git pull` sur le NAS installerait la version du Sprint 4. Le travail NAS ne fonctionne pas avec le Sprint 11 sans adaptation (fichiers `config.js`, `index.js`, `EcranConnexion.tsx`, `sessions.js`, `tunnel.js` modifiés des deux côtés). | petit à moyen |
| C2 | **Un joueur = un pseudo, sans secret.** Vérifié : deux connexions « Thrall » obtiennent chacune un jeton valide. | N'importe qui ayant le lien peut taper le pseudo d'un autre et contrôler son personnage, lire son sac et **ses notes privées**, recevoir ses murmures. Il peut aussi entrer avec un nouveau pseudo et créer un personnage à n'importe quelle table. Tolérable avec un lien qui change à chaque partie ; **inacceptable avec une adresse fixe**. Le « code de table » de la branche NAS bloque les inconnus mais pas l'usurpation entre joueurs. | moyen |
| C3 | **Aucune sauvegarde de secours, et écrasement silencieux.** Un fichier `scene.json` (carte, pions, brouillard), `quetes.json`, `notes.json` ou `combat.json` jugé invalide est ignoré au démarrage. Le commentaire du code dit « jamais supprimé », mais à la première modification en jeu **il est remplacé par une version vide**. | Perte de la carte préparée, des quêtes ou des carnets de tous les joueurs. Risque aggravé par le fait que seules les fiches de personnage ont un système de migration : la carte est validée en mode strict, donc le moindre changement de format futur rendrait les anciennes cartes « invalides ». Sur le NAS, tu n'auras plus l'historique de versions de Google Drive comme filet. | moyen |

### IMPORTANT

| # | Problème | Conséquence concrète | Effort |
|---|---|---|---|
| I1 | **Le brouillard ne protège pas l'image de la carte.** L'image entière est envoyée au navigateur, le noir est dessiné par-dessus. Et tout le dossier d'images/sons est servi **sans aucune connexion** (vérifié : réponse « 200 OK » sans jeton). | Un joueur curieux voit toute la carte (touche F12 du navigateur). Toute personne connaissant l'adresse peut télécharger cartes, portraits et textures. | moyen (exiger la connexion) ; gros (vrai découpage de la carte côté serveur — je ne le recommande pas) |
| I2 | **Les images et polices de WoW appartiennent à Blizzard.** | Entre amis sur un lien éphémère, risque faible. Sur une adresse fixe où le dossier d'images est public (I1), c'est une diffusion publique. À fermer avant la mise en ligne. *Ceci n'est pas un avis juridique.* | réglé par I1 + filtre d'accès |
| I3 | **Règles D&D 5e codées en dur** dans ~27 fichiers (caractéristiques, bonus de maîtrise, emplacements de sorts, concentration, repos, classe d'armure). L'écran d'accueil affiche « Donjons & Dragons ». | Si le livre officiel utilise un autre système, une grande partie du serveur et de la fiche est à reprendre. S'il est basé sur la 5e (**à vérifier à la sortie**), l'essentiel reste. | gros si système différent ; moyen pour préparer la structure |
| I4 | **Inutilisable sur téléphone, médiocre sur tablette.** L'interface est conçue pour 1920×1080 minimum, bloque l'affichage vertical, dépend du survol de souris et du clavier ; pas de zoom à deux doigts sur la carte. | Un joueur sans ordinateur ne peut pas jouer. | gros (vraie version mobile) ; moyen (vue « compagnon » : fiche + dés + discussion) |
| I5 | **Charge sur un NAS lent** (voir phase 1 bis). Les écritures disque bloquent le serveur pendant qu'elles se font ; le fichier de carte est réécrit en entier chaque seconde pendant que le MJ peint le brouillard, et il peut contenir jusqu'à 20 000 coups de pinceau. | Sur ton PC, invisible. Sur un NAS à disques durs et processeur modeste, des saccades sont **probables pendant la peinture du brouillard**. Non mesuré sur le NAS : à vérifier. | moyen |
| I6 | **3 bibliothèques avec des failles connues** (`body-parser` et `zod` : gravité haute ; `qs` : modérée), de type « faire planter le serveur ». Corrigeables par une mise à jour automatique. | Sans gravité en local ; à corriger avant exposition sur Internet. | petit |
| I7 | **Les sessions vivent en mémoire.** Un redémarrage du serveur renvoie tout le monde à l'écran de connexion ; la liste des joueurs expulsés et les jets en attente sont oubliés. | Sur le NAS, où le serveur redémarrera tout seul (mise à jour, plantage), c'est une gêne en pleine partie. | petit à moyen |
| I8 | **Les joueurs modifient librement leurs propres points de vie, ressources et états**, déplacent leur pion n'importe où et n'importe quand (y compris dans le brouillard), et peuvent supprimer leur personnage. | C'est un choix de confiance courant dans les VTT, et tout s'affiche dans le journal. Mais c'est une possibilité de triche à connaître. À toi de décider (question 6). | petit (options pour le MJ) |
| I9 | **Synchronisation Google Drive ↔ NAS prévue en double sens** dans le guide NAS existant, alors que le serveur écrit dans ce dossier en continu. | Risque de fichiers « en conflit » et de retour en arrière d'une sauvegarde. À remplacer par : le NAS est la seule référence, Google Drive ne reçoit que des copies de secours. | petit (décision + guide) |
| I10 | **Aucun contrôle automatique sur GitHub** (pas de tests lancés à chaque envoi), aucun test de l'interface. | Une modification peut casser le jeu sans alerte. | petit |

### MINEUR

| # | Problème | Effort |
|---|---|---|
| M1 | Une seule carte par table : changer de carte **efface le brouillard et les dessins**. Pas de scènes préparées à l'avance. | moyen |
| M2 | Un joueur peut choisir le pseudo « Maitre du Jeu » (confusion dans la liste des présents ; il n'obtient aucun droit). | petit |
| M3 | N'importe quel joueur connecté voit la liste de toutes les tables et peut en rejoindre n'importe laquelle. | petit |
| M4 | Les jetons expirés et les compteurs d'essais ne sont jamais nettoyés (fuite de mémoire lente ; sans effet sur une soirée, à corriger pour un serveur allumé des semaines). | petit |
| M5 | En cas de plantage brutal, la dernière seconde de modifications non écrites est perdue (elles ne sont sauvées que sur un arrêt normal). | petit |
| M6 | Nombre de connexions « joueur » non limité : un script peut créer des milliers de jetons. | petit |
| M7 | Scripts NAS existants fragiles : arrêt par recherche de nom de programme, journal conservé sur 2 fichiers seulement, mots de passe et jeton de tunnel en clair dans un dossier partagé (droits d'accès à régler). | petit |
| M8 | Quelques fichiers très longs (`moteur-carte.js` : 1 051 lignes ; 5 500 lignes de mise en forme). Pas un bug, mais plus difficile à faire évoluer. | moyen, non urgent |
| M9 | Pas d'en-tête de sécurité « Content-Security-Policy » (une protection supplémentaire du navigateur) ; images vectorielles SVG acceptées dans les dossiers d'images (elles peuvent contenir du code ; seul le MJ les dépose). | petit |

### Avec 7 personnes connectées en même temps

- **Ce qui tient** : les déplacements de pions sont verrouillés (deux personnes ne tirent pas le même pion), les messages fréquents sont limités, un seul jet en attente par personnage. Le serveur traite les demandes une par une, donc pas de mélange de données. 7 connexions est une charge très faible pour ce type de programme.
- **Ce qui peut gêner** : I5 (peinture du brouillard sur le NAS), I7 (tout le monde déconnecté à chaque redémarrage), et la **vitesse d'envoi de ta connexion Internet** — chaque joueur télécharge l'image de la carte (jusqu'à 40 Mo acceptés). Avec la fibre, sans souci ; sinon, alléger les cartes.

### Un joueur peut-il tricher ou voir les infos du MJ ?

| Question | Réponse |
|---|---|
| Voir un monstre caché, son nom, ses points de vie exacts ? | **Non.** Filtré par le serveur. Il voit seulement une santé arrondie à 10 % pour les monstres visibles. |
| Lire le compendium, le bestiaire, les outils du MJ ? | **Non.** Réservés au rôle MJ, vérifié côté serveur. |
| Devenir MJ ? | **Non** sans le mot de passe (5 essais puis 15 minutes de blocage). |
| Truquer un jet de dés ? | **Non.** Les dés sont lancés par le serveur et le MJ voit chaque jet dès sa création. |
| Voir toute la carte malgré le brouillard ? | **Oui** (I1). |
| Se faire passer pour un autre joueur ? | **Oui** (C2). |
| Se soigner, se rendre du mana, se retirer un malus ? | **Oui**, sur son propre personnage (I8), visible dans le journal. |
| Voir le contenu d'un coffre sans l'ouvrir ? | **Non.** |

---

# PHASE 1 BIS — HÉBERGEMENT SUR LE NAS

## 2.1 Le DS218play peut-il faire tourner le projet ?

### Ce que j'ai pu vérifier

| Point | Résultat | Source |
|---|---|---|
| Processeur | Realtek RTD1296, 4 cœurs, 1,4 GHz, 64 bits | Fiche produit Synology |
| Mémoire | 1 Go | Fiche produit Synology |
| Docker (« Container Manager ») | **Non proposé officiellement** sur ce modèle. Il existe un script non officiel pour le forcer ; **je le déconseille** (non supporté, et 1 Go de mémoire est trop juste). | Projet communautaire `007revad` sur GitHub |
| Version du système (DSM) | DSM 7.3 serait la **dernière version installable** sur ce modèle. | Notes de version citées sur les forums Synology |
| Besoin du projet | Node.js **version 20.12 minimum** (le code utilise une fonction apparue à cette version). | Lecture du code |
| Mémoire utilisée par le serveur | **~100 Mo** au repos (mesuré sur une copie, sur un autre type de processeur : ordre de grandeur). | Mesure |
| Place sur le disque | ~105 Mo de bibliothèques + tes images. | Mesure |
| Bibliothèques à « fabriquer » sur place | Aucune : le serveur n'utilise que du code prêt à l'emploi. | Lecture du code |
| Node.js 22 sur ce modèle | Le projet Homebridge liste le DS218play comme compatible avec le paquet « Node.js v22 » de Synology à partir de DSM 7.2. **Indice sérieux mais indirect.** | Wiki Homebridge |

**Conclusion honnête** : le NAS est modeste mais **devrait suffire** pour 7 personnes, sans Docker, à trois conditions à contrôler ci-dessous. Le point faible sera la fluidité pendant la peinture du brouillard (I5), pas le nombre de joueurs.

### Ce que tu dois contrôler toi-même sur le NAS

1. **Version de DSM** : *Panneau de configuration > Centre d'infos*. Il faut DSM 7.2 ou plus récent.
2. **Node.js** : *Centre de paquets*, cherche « Node.js ». Note les versions proposées (v20 ? v22 ?). Il faut **v22** de préférence (v20 n'est plus maintenue depuis avril 2026). **Si aucune des deux n'apparaît, le plan ne tient pas tel quel** et il faudra en reparler.
3. **Mémoire libre** : *Moniteur de ressources > Performances > Mémoire*, un jour d'usage normal. Il faut **au moins 250 Mo réellement disponibles**. Si tu utilises Synology Photos ou Drive en même temps, ce sera peut-être trop juste.
4. **Git** : *Centre de paquets*, cherche « Git Server » (il apporte la commande `git` nécessaire au « pull »). À vérifier qu'il est proposé.
5. **Type de disques et espace libre** : *Gestionnaire de stockage*.
6. **Ta connexion Internet** : débit d'envoi (test sur speedtest.net), et si ta box a une adresse publique (question 3 en fin de document).
7. **Le dépôt GitHub est-il privé ou public ?** (cela change la façon dont le NAS s'y connecte).

## 2.2 Installation et mise à jour depuis GitHub — méthode la plus simple

**Principe** : le NAS garde une copie du projet ; un bouton dans DSM la met à jour. Tu n'ouvres la fenêtre de commandes (SSH) **qu'une seule fois**, à l'installation.

> Ces étapes seront détaillées avec les commandes exactes en phase 3, une fois les contrôles ci-dessus faits. **C'est toi qui les exécuteras** : je ne touche pas à ton NAS.

**Avant tout (une fois, sur GitHub)** : créer la branche `main` qui réunit tout (lot 0). Sans cela, le NAS installerait une vieille version.

**Installation (une seule fois, ~1 h)**

1. **Sécuriser le NAS** : DSM à jour, double authentification sur ton compte administrateur, blocage automatique après échecs, pare-feu activé, aucune redirection de port sur la box. Le guide existant de la branche `hebergement-nas` (étape 1) est correct sur ce point.
2. **Créer un utilisateur `vtt` sans droits d'administration** : c'est lui qui fera tourner la table. Si le VTT était piraté, l'intrus n'aurait que ses droits.
3. **Créer deux dossiers partagés** : `vtt` (le programme) et `jdr` (tes données : parties, cartes, images). Les garder séparés permet de mettre à jour l'un sans jamais risquer l'autre.
4. **Installer les paquets** Node.js et Git Server depuis le Centre de paquets.
5. **Activer SSH temporairement**, se connecter depuis le PC, puis : télécharger le projet depuis GitHub dans `vtt`, installer les bibliothèques, remplir le fichier `.env` (dossier des données, mot de passe MJ, adresse).
6. **Copier tes données** actuelles (dossier Google Drive `JDR`) dans `jdr`.
7. **Désactiver SSH.**
8. **Démarrage automatique** : *Panneau de configuration > Planificateur de tâches* : une tâche « au démarrage du NAS » qui lance la table.

**Mise à jour (à chaque nouvelle version, ~2 minutes, sans SSH)**

Dans le Planificateur de tâches, une tâche « Mettre à jour la table » que tu lances d'un clic. Elle fera, dans l'ordre : copie de sécurité des données → arrêt de la table → `git pull` → installation des bibliothèques → redémarrage → vérification que la table répond. En cas d'échec, elle remet la version précédente. **Ce script n'existe pas encore** (phase 3).

**Point d'attention — la compilation de l'interface.** Elle consomme beaucoup de mémoire ; sur 1 Go, elle risque d'échouer ou de durer plusieurs minutes (**à vérifier**). Ma proposition : la faire faire **automatiquement par GitHub** à chaque nouvelle version (service gratuit « GitHub Actions »), de sorte que le NAS récupère une interface déjà prête et n'ait rien à compiler.

## 2.3 Accès à distance sécurisé — comparaison

Le VTT a besoin d'une connexion temps réel (WebSocket) : les trois solutions sérieuses ci-dessous la supportent.

| | **A. Tunnel Cloudflare + nom de domaine** | **B. Tailscale (réseau privé)** | **C. Tailscale Funnel** | **D. Ouvrir un port sur la box** |
|---|---|---|---|---|
| Principe | Le NAS ouvre un tunnel vers Cloudflare ; les joueurs vont sur `https://table.ton-domaine.fr` | Chaque joueur installe une application qui le met dans un réseau privé avec ton NAS | Comme A, mais adresse fournie par Tailscale (`nom.xxxx.ts.net`) | Internet frappe directement à la porte de ton NAS |
| Ce que le joueur doit faire | Rien : cliquer sur le lien | Installer une application et créer un compte | Rien | Rien |
| Adresse fixe | Oui, à ton nom | Oui (interne) | Oui, peu lisible | Oui, avec un service d'adresse dynamique |
| Port ouvert sur la box | **Aucun** | **Aucun** | **Aucun** | **Oui** |
| Filtre avant d'atteindre le VTT | **Oui** (Cloudflare Access : code reçu par e-mail, gratuit jusqu'à 50 personnes) | Oui par nature (invités seulement) | **Non** : seul le VTT se défend | Non |
| Coût | Domaine ~10 €/an ; le reste gratuit | Gratuit (limites du plan gratuit **à vérifier**) | Gratuit | Gratuit |
| Difficulté pour toi | Moyenne (~1 h, une fois) | Faible pour toi, **forte pour 6 joueurs** | Faible | Moyenne, et dangereuse |
| Inconvénients | Un tiers (Cloudflare) voit passer le trafic ; envoi limité à 100 Mo par fichier (les cartes sont à 40 Mo max : compatible) ; il faut faire tourner le programme `cloudflared` sur le NAS (**à vérifier** sur ce modèle) | Friction à chaque nouveau joueur ou nouvel appareil ; pas de cadenas HTTPS sans réglage supplémentaire | Débit limité sans chiffre publié ; fonction encore décrite comme « bêta » ; pas de filtre | Expose le NAS aux robots qui balaient Internet en permanence ; impossible si ton fournisseur partage ton adresse (fréquent en 4G/5G) |

**QuickConnect** (le service Synology) n'est pas une option : il ne relaie que les applications Synology, pas un programme comme le VTT (**à vérifier**, mais c'est ma compréhension).

### Recommandation : **A — tunnel Cloudflare + domaine + filtre par e-mail**

- Les joueurs n'installent rien, l'adresse ne change plus, aucune porte n'est ouverte chez toi.
- Le filtre Cloudflare Access ajoute une **deuxième serrure** : un inconnu n'atteint même pas l'écran de connexion du VTT. Seules les adresses e-mail que tu as listées reçoivent un code d'entrée.
- Le code du tunnel permanent existe déjà sur la branche `hebergement-nas`.
- Le délai ajouté (quelques dizaines de millisecondes) est sans importance pour un jeu de rôle.

Plan B si tu ne veux pas acheter de domaine : **C (Funnel)**, mais seulement après correction de C2 et I1, puisque le VTT serait alors la seule défense.

### Les risques, sans les adoucir

- **Ouvrir un port vers un NAS est la cause n°1 des NAS piratés et chiffrés contre rançon.** C'est pour cela que D est exclu.
- Avec un tunnel, **DSM (l'administration du NAS) reste invisible** de l'extérieur. Mais **le VTT, lui, devient public** : toute faille du VTT devient exploitable par n'importe qui. D'où l'utilisateur `vtt` sans droits, les dossiers séparés, et le filtre par e-mail.
- Le jeton du tunnel et le mot de passe MJ sont des clés : s'ils fuient, il faut les changer immédiatement.
- Aucune de ces solutions ne dispense de **sauvegardes** (voir 2.4).

## 2.4 Ce que le projet doit changer pour vivre hors de ton ordinateur

| Sujet | Aujourd'hui | À faire |
|---|---|---|
| **Version installée** | Éparpillée sur 6 branches | Une branche `main` unique (C1) |
| **Adresse** | Lien aléatoire qui change à chaque lancement | Tunnel permanent + domaine (code existant sur `hebergement-nas`, à adapter au Sprint 11) |
| **Écoute réseau** | Le serveur accepte les connexions de tout le réseau local | N'écouter que le NAS lui-même (`127.0.0.1`) : seul le tunnel peut entrer |
| **Mots de passe joueurs** | Aucun | Un mot de passe (ou code personnel) par joueur, enregistré sous forme illisible (« hachée ») ; pseudos réservés ; blocage après essais ratés (C2) |
| **Mot de passe MJ** | En clair dans `.env` | Acceptable si le dossier n'est lisible que par l'utilisateur `vtt` ; phrase longue |
| **Images et sons** | Publics | Accessibles seulement une fois connecté (I1) |
| **Sauvegardes** | Une seule copie, synchronisée par Google Drive | (1) copie automatique datée par le VTT à chaque démarrage et chaque heure de jeu, en gardant les 30 dernières ; (2) l'outil Synology « Hyper Backup » chaque nuit vers Google Drive ou un disque USB ; (3) ne plus jamais écraser un fichier illisible : le mettre de côté et alerter le MJ (C3) |
| **Dossier de données** | Le code exige un dossier « cloud » et avertit sinon | Accepter un dossier du NAS sans avertissement ; abandonner la synchronisation en double sens (I9) |
| **Sessions** | Perdues à chaque redémarrage | Conservées sur disque (I7) |
| **Démarrage / arrêt / journal** | Fenêtre de commandes sur le PC | Tâches DSM, relance automatique, journal avec rotation (M7) |
| **Mise à jour** | Manuelle | Script en un clic avec retour arrière (2.2) |
| **Compilation** | Sur le PC | Par GitHub (2.2) |
| **Tes fichiers du MJ** (cartes, portraits) | Déposés dans Google Drive | Déposés dans le dossier `jdr` du NAS (lecteur réseau à la maison), ou téléversés depuis l'interface (déjà possible pour les cartes) |
| **Jouer depuis le PC** | Possible | Plus nécessaire ; le verrou « deux serveurs sur les mêmes données » existe déjà et reste utile |

---

# PHASE 2 — PROPOSITIONS (rien n'est appliqué)

## 3.1 Corrections, dans l'ordre

| Ordre | Correction | Réf. | Effort | Pourquoi à ce rang |
|---|---|---|---|---|
| 1 | Réunir les branches dans `main`, y compris le travail NAS | C1 | petit–moyen | Tout le reste se construit dessus |
| 2 | Sauvegardes automatiques + ne plus écraser un fichier illisible + migrations pour carte/quêtes/notes | C3 | moyen | Protéger les données avant de toucher à quoi que ce soit d'autre |
| 3 | Mettre à jour les 3 bibliothèques vulnérables ; tests automatiques sur GitHub | I6, I10 | petit | Rapide, sécurise les lots suivants |
| 4 | Comptes joueurs avec mot de passe, pseudos réservés, limites d'essais | C2, M2, M6 | moyen | Indispensable avant toute adresse fixe |
| 5 | Images et sons réservés aux personnes connectées | I1, I2 | moyen | Idem |
| 6 | Sessions conservées, nettoyage des jetons, sauvegarde sur plantage | I7, M4, M5 | petit–moyen | Confort sur un serveur toujours allumé |
| 7 | Préparation NAS : écoute locale, scripts, compilation par GitHub | 2.4 | moyen | Mise en ligne |
| 8 | Alléger l'écriture du brouillard | I5 | moyen | **Seulement si** les saccades sont constatées sur le NAS |
| 9 | Options MJ : verrouiller les points de vie des joueurs, limiter les déplacements au tour du joueur | I8 | petit | Selon ta réponse à la question 6 |
| 10 | Tables visibles seulement par leurs participants | M3 | petit | Utile si tu mènes plusieurs campagnes |

## 3.2 Améliorations — classées par gain pour les joueurs / effort

**Réserve importante** : je n'ai pas vu l'interface avec tes images. Ces propositions viennent de la lecture du code ; certaines existent peut-être déjà sous une forme que je n'ai pas repérée. À confirmer ensemble sur des captures d'écran.

### Gain fort, effort petit

| Proposition | Détail |
|---|---|
| **Musique et ambiance en boucle** | Aujourd'hui il n'y a que des bruitages ponctuels. Ajouter : une musique de fond et une ambiance (taverne, forêt, pluie) lancées par le MJ, avec fondu, volume séparé de celui des bruitages, réglable par chaque joueur. C'est le meilleur rapport immersion/effort du projet. |
| **Carte des raccourcis** | Les touches existent (B sacs, C fiche, P grimoire, L quêtes, I initiative, N carnet, Entrée discussion) mais rien ne les annonce. Une fenêtre « ? » et le rappel de la touche au survol des boutons. |
| **Visite guidée à la première connexion** | 5 bulles : « ton personnage », « ta barre d'actions », « lancer un dé », « la discussion », « la carte ». Passable et rejouable. |
| **Annonce « C'est ton tour »** | Bandeau et son pour le joueur concerné, cadre du personnage actif mis en valeur pour tous. |
| **État de la liaison plus clair** | Le bandeau « reconnexion » existe ; ajouter un petit voyant permanent et un message quand le MJ lui-même est absent. |

### Gain fort, effort moyen

| Proposition | Détail |
|---|---|
| **Scènes préparées** | Plusieurs cartes par table, chacune avec sa grille, ses pions, son brouillard et sa musique ; le MJ bascule d'une scène à l'autre sans rien perdre (corrige M1). Gros gain de fluidité en partie. |
| **Règle de mesure** | Tirer un trait pour connaître une distance en cases/mètres, et gabarits de zone (cercle, cône, ligne) pour les sorts. Je n'ai pas trouvé d'outil de mesure parmi les outils de carte actuels. |
| **Éclairage d'ambiance simple** | Un filtre de teinte par scène (nuit, torche, donjon, aube) et une transition en fondu au changement de carte. Peu coûteux et très visible. Un vrai calcul de lumière et de lignes de vue serait un *gros* chantier que je ne recommande pas sur ce NAS. |
| **Vue « compagnon » pour téléphone** | Pas l'interface complète : seulement fiche, points de vie, dés, discussion, quêtes. Permet à un joueur de suivre et d'agir depuis un téléphone pendant que la carte est sur un autre écran. |
| **Tablette** | Zoom à deux doigts et déplacement de la carte au doigt, appui long à la place du survol. |
| **Écran d'accueil du MJ avant la partie** | Une liste « prêt à jouer » : joueurs connectés, carte chargée, musique prête, sauvegarde du jour faite. |

### Gain moyen, effort petit

| Proposition | Détail |
|---|---|
| **Jets demandés par le MJ** | Le MJ clique « Test de Perception pour tous » ; chaque joueur reçoit le bouton prêt à lancer. |
| **Historique des jets filtrable** | Retrouver « mes jets » ou « les jets du combat ». |
| **Image montrée à tous** | Le MJ affiche une illustration (un lieu, un personnage) en plein écran chez tous les joueurs. |
| **Confirmation avant toute action destructrice** | Changer de carte, tout cacher/révéler, supprimer un personnage. À vérifier lesquelles demandent déjà confirmation. |
| **Réglage de taille de l'interface** | Un curseur par joueur, pour les petits écrans de portable. |

### Je ne recommande pas (pour l'instant)

- Vidéo ou voix intégrée : gardez Discord, c'est mieux fait et cela chargerait le NAS.
- Dés en 3D physiques : joli, coûteux, et la fenêtre de dés animée existe déjà.
- Vraie version mobile complète : trop d'effort pour 7 personnes ; la vue « compagnon » couvre le besoin.

## 3.3 Préparer l'arrivée du livre officiel (sans coder ses règles)

Le but : que les règles deviennent un **module remplaçable**, comme les races et classes le sont déjà.

1. **Rassembler tout ce qui est « D&D »** dans un seul dossier `systeme/dnd5e/` : caractéristiques, calcul des bonus, emplacements de sorts, repos, résolution d'une attaque. Le reste du VTT (carte, discussion, sacs, butins, quêtes, sons) ne doit plus y faire référence directement.
2. **Définir un « contrat »** : la liste des questions que le VTT pose au système de règles (« quels sont les attributs d'une fiche ? », « comment calcule-t-on ce jet ? », « que récupère-t-on au repos ? »). Le système officiel n'aura qu'à répondre aux mêmes questions.
3. **Rendre la fiche de personnage pilotée par les données** : les noms et le nombre des attributs lus dans un fichier, pas écrits dans le code.
4. **Numéroter la version du système** dans chaque sauvegarde, pour convertir proprement les personnages existants.
5. **Geler d'ici là** tout nouveau développement de règles D&D : chaque ajout augmente le travail de remplacement.

Effort : moyen pour les points 1, 2 et 4 (réorganisation sans changement visible, protégée par les 161 tests). Le point 3 est à faire quand le livre sera connu.

## 3.4 Plan de réalisation en petits lots

Chaque lot est indépendant, livré sur sa propre branche, avec les tests automatiques au vert, et **n'est fusionné qu'après ta validation**.

| Lot | Contenu | Ce que tu testes toi-même |
|---|---|---|
| **0 — Remise en ordre** | Créer `main` = Sprint 11 + travail NAS adapté + fichier de consignes. Mise à jour des bibliothèques. Tests automatiques sur GitHub. | Lancer `npm run partie` sur ton PC comme d'habitude : même écran, mêmes parties, mêmes personnages qu'avant. |
| **1 — Filet de sécurité des données** | Copies datées automatiques, fichier illisible mis de côté au lieu d'être écrasé, alerte au MJ, migrations pour carte/quêtes/notes, bouton « restaurer une sauvegarde ». | Jouer 10 minutes, fermer, vérifier qu'un dossier de copies daté est apparu. Abîmer volontairement une **copie** de `scene.json` : le serveur doit prévenir et ne rien écraser. Restaurer une sauvegarde. |
| **2 — Comptes joueurs** | Mot de passe par joueur à la première connexion, pseudos réservés, blocage après essais ratés, réinitialisation par le MJ. | Avec deux navigateurs : créer « Thrall », puis tenter d'entrer comme « Thrall » avec un mauvais mot de passe → refus. Réinitialiser le mot de passe depuis l'écran MJ. |
| **3 — Images protégées** | Cartes, portraits et sons servis uniquement aux connectés. | Ouvrir l'adresse d'une carte dans une fenêtre de navigation privée → refus. En jeu, tout s'affiche comme avant. |
| **4 — Serveur longue durée** | Sessions conservées au redémarrage, nettoyage mémoire, sauvegarde sur plantage. | En pleine partie, arrêter et relancer le serveur : les joueurs se reconnectent seuls, sans retaper leur mot de passe. |
| **5 — Prêt pour le NAS** | Écoute locale, scripts de démarrage/arrêt/mise à jour, compilation par GitHub, guide pas à pas réécrit. | **Tu installes sur le NAS en suivant le guide** ; la table s'ouvre depuis ton réseau local ; le bouton « Mettre à jour » fonctionne ; redémarrer le NAS relance la table. Mesurer la mémoire dans le Moniteur de ressources. |
| **6 — Accès distant** | Domaine, tunnel Cloudflare, filtre par e-mail. Surtout de la configuration, guidée. | Depuis ton téléphone **en 4G** (pas en Wi-Fi) : le lien demande un code par e-mail, puis affiche le VTT. Un e-mail non listé est refusé. Faire une partie d'essai avec 1 ou 2 joueurs. |
| **7 — Essai de charge** | Partie test à 7. Si saccades au brouillard : alléger l'écriture (I5). | Peindre du brouillard pendant que les joueurs bougent : pas de blocage. |
| **8 — Prise en main** | Visite guidée, carte des raccourcis, « c'est ton tour », voyant de liaison. | Faire entrer un joueur qui n'a jamais vu l'outil, sans rien lui expliquer, et noter où il bloque. |
| **9 — Ambiance** | Musique et ambiances en boucle, volumes séparés, filtre de teinte. | Lancer une musique depuis l'écran MJ : tous l'entendent, chacun règle son volume ; changer d'ambiance en fondu. |
| **10 — Scènes préparées et mesure** | Plusieurs cartes par table, règle de mesure, gabarits. | Préparer 2 scènes, basculer de l'une à l'autre : brouillard et pions conservés. Mesurer une distance. |
| **11 — Compagnon téléphone / tablette** | Vue réduite et gestes tactiles. | Suivre une partie depuis un téléphone : fiche, dés, discussion. |
| **12 — Module de règles** | Réorganisation décrite en 3.3 (sans règles officielles). | Rien ne doit changer à l'écran ; rejouer un combat complet. |

Les lots 0 à 6 mènent à un VTT hébergé et sûr. Les lots 8 à 11 sont indépendants et peuvent passer avant ou après selon tes priorités.

---

# Tout ce qui est « à vérifier » (récapitulatif)

1. Le Sprint 11 (`claude/nifty-heisenberg-16rhf2`) est bien ta version de référence.
2. Le Centre de paquets du DS218play propose Node.js v22 (ou au moins v20) et Git Server.
3. Version de DSM installée ; DSM 7.3 comme dernière version possible sur ce modèle.
4. Mémoire réellement libre sur le NAS en usage normal.
5. Le programme `cloudflared` fonctionne sur ce NAS sans Docker (processeur compatible en théorie ; non testé).
6. La compilation de l'interface est trop lourde pour le NAS (d'où la proposition de la confier à GitHub).
7. Fluidité de la peinture du brouillard sur le NAS.
8. QuickConnect ne peut pas relayer le VTT.
9. Limites actuelles du plan gratuit de Tailscale.
10. Système de règles du livre officiel (basé sur la 5e ou non).
11. Mes propositions d'interface, faites sans avoir vu l'écran avec tes images.
12. Le dépôt GitHub est privé ou public.

---

# Questions avant la phase 3

**Organisation**

1. Confirmes-tu que la version à garder est le **Sprint 11** (branche `claude/nifty-heisenberg-16rhf2`), et que je peux créer une branche `main` qui réunit tout ? Les anciennes branches seraient conservées, pas supprimées.
2. Le dépôt GitHub est-il **privé** ou **public** ?

**NAS et réseau**

3. Peux-tu me donner les résultats des contrôles du § 2.1 : version de DSM, versions de Node.js proposées, présence de Git Server, mémoire libre, et les autres usages du NAS (Photos, Drive, sauvegardes…) ?
4. Quel est ton fournisseur d'accès et ton type de connexion (fibre, ADSL, 4G/5G) ? Connais-tu ton débit d'envoi ?
5. Acceptes-tu d'acheter un **nom de domaine (~10 €/an)** et de créer un compte Cloudflare gratuit ? Sinon, je bascule sur la solution C (Tailscale Funnel).

**Règles de table**

6. Les joueurs doivent-ils pouvoir modifier eux-mêmes leurs points de vie et ressources (confiance, comme aujourd'hui), ou préfères-tu que seul le MJ le puisse, ou une option réglable par table ?
7. Pour l'accès des joueurs : un **mot de passe personnel** choisi à la première connexion te convient-il, ou préfères-tu un **lien d'invitation personnel** envoyé à chacun (plus simple pour eux, à renvoyer s'ils changent d'appareil) ?
8. Le brouillard qui ne protège pas l'image de la carte : acceptes-tu cette limite une fois les images réservées aux joueurs connectés (ma recommandation), ou est-ce important pour toi qu'un joueur ne puisse vraiment pas voir la carte entière ?

**Données**

9. Où veux-tu la copie de secours hors du NAS : Google Drive, un disque USB branché au NAS, ou les deux ?
10. Y a-t-il aujourd'hui des parties ou personnages **réels** à préserver absolument, ou seulement des essais ? (Cela fixe le niveau de prudence du lot 1.)

**Usage**

11. Tes joueurs jouent-ils tous sur ordinateur ? Quelqu'un a-t-il besoin du téléphone ou de la tablette (cela décide du rang du lot 11) ?
12. Utilisez-vous Discord (ou autre) pour la voix ? Je pars du principe que oui.
13. Parmi les lots 8 à 11 (prise en main, ambiance, scènes, téléphone), lequel veux-tu en premier ?
14. As-tu une date ou une information sur le livre officiel (éditeur, système de règles annoncé) ?
15. Peux-tu m'envoyer 3 ou 4 **captures d'écran** d'une partie en cours (vue joueur et vue MJ) ? Je pourrai alors juger réellement la clarté de l'écran.

**Je n'attaque pas la phase 3 sans ton accord.**

---

## Sources consultées pour la partie NAS

- Fiche produit Synology DS218play (processeur, mémoire) : https://www.synology.com/en-eu/store/Refurbished%20DS218play
- Script communautaire Container Manager pour modèles ARM (indique que le DS218play en est exclu officiellement) : https://github.com/007revad/ContainerManager_for_all_armv8
- Wiki Homebridge, plateformes Synology compatibles avec Node.js v22 : https://github.com/homebridge/homebridge/wiki/Install-Homebridge-on-Synology-DSM
- Notes de version DSM 7.3 relayées sur SynoForum : https://www.synoforum.com/threads/version-7-3-81180.15344/latest
- Tailscale Funnel (ports, limites) : https://tailscale.com/kb/1223/tailscale-funnel
- Hébergement d'un VTT comparable (Foundry) derrière Tailscale : https://foundryvtt.wiki/en/setup/hosting/tailscale

Les sites synology.com et tailscale.com n'étaient pas consultables directement depuis mon environnement : ces informations viennent de résultats de recherche, pas d'une lecture des pages officielles.

---

# Mise à jour du 14 novembre 2026 — tes réponses et le plan révisé

## Ce que tes captures confirment

| Point | Résultat |
|---|---|
| Modèle, processeur, mémoire | DS218play, Realtek RTD1296, 4 cœurs, 1,4 GHz, 1 024 Mo : conforme à ce que j'avais trouvé. |
| Node.js | **v18, v20 et v22 sont déjà installés.** Le doute principal est levé : on utilisera la v22. |
| Git Server | Proposé par le Centre de paquets, **pas encore installé**. À installer au moment du lot 5, pas avant. |
| Connexion | Fibre, ~790 Mbit/s en envoi : aucune limite pour 6 joueurs, même avec de grosses cartes. |

**Reste à contrôler** : la version de DSM (*Panneau de configuration > Centre d'infos > Général*) et la mémoire réellement libre (*Moniteur de ressources > Performances > Mémoire*).

## Décisions prises

| Sujet | Décision |
|---|---|
| Version de référence | Sprint 11. Création d'une branche `main` qui réunit tout. |
| Dépôt | Public : le NAS pourra faire le « pull » sans mot de passe. **Conséquence : aucun secret ni image de WoW ne doit jamais y entrer** (c'est déjà le cas, vérifié). |
| Accès distant | Tunnel Cloudflare + nom de domaine + filtre par e-mail. |
| Points de vie | Option réglable par table : « les joueurs gèrent leurs points de vie » ou « le MJ seul ». |
| Accès joueurs | Mot de passe personnel choisi à la première connexion. |
| Copie de secours | Google Drive. Elle peut être automatique (outil Synology « Hyper Backup »), pas besoin de le faire à la main. |
| Données actuelles | Essais uniquement : le lot 1 reste nécessaire mais sans procédure de reprise lourde. |
| Appareils | Tous sur ordinateur : la vue téléphone/tablette est **retirée du plan**. |
| Voix | Discord : rien à intégrer. |
| Première amélioration | Prise en main. |

## Scènes préparées et champ de vision (ta question 8)

**Oui pour les scènes préparées** : plusieurs cartes par table, chacune avec sa grille, ses pions et son brouillard, que tu prépares à l'avance et entre lesquelles tu bascules en partie. Effort moyen. C'est le lot 9.

**Le champ de vision par joueur est possible, en trois niveaux de difficulté :**

| Niveau | Ce que ça fait | Effort |
|---|---|---|
| 1. Brouillard par joueur, à la main | Tu révèles une zone pour un joueur précis (l'éclaireur voit la salle, pas les autres). | moyen |
| 2. Vision automatique simple | Chaque héros a un rayon de vision ; le brouillard s'ouvre autour de lui quand il avance. Pas de murs : on « voit » à travers. | moyen |
| 3. Vision avec murs | Tu traces les murs et les portes sur la carte ; chaque joueur ne voit que ce que son personnage peut voir. | **gros** |

Le calcul se ferait dans le navigateur de chaque joueur : le NAS n'aurait pas à le supporter.

**Limite à connaître, sans l'adoucir** : dans les trois cas, l'image complète de la carte est toujours envoyée au navigateur, et le masque est dessiné par-dessus. Un joueur qui sait fouiller son navigateur peut la retrouver. Pour l'empêcher vraiment, il faudrait découper la carte en morceaux et n'envoyer que les morceaux visibles : gros chantier, lourd pour ce NAS. Entre amis, je recommande d'accepter cette limite.

**Ma recommandation** : lot 9 (scènes) puis niveau 2. Le niveau 3 seulement si, après quelques parties, il te manque réellement.

## Ce que montrent tes deux captures de l'interface

Jugement sur image réduite, donc à confirmer sur ton écran :

1. **Beaucoup d'espace perdu** : la carte occupe environ la moitié de la largeur, avec de larges bandes sombres à gauche et à droite.
2. **Cadres du groupe peu lisibles** : des boutons gris avec un texte très petit ; on ne voit ni barre de vie, ni couleur de classe, ni qui est connecté.
3. **Textes très petits** partout (noms sous les pions, discussion, infobulles).
4. **Icônes sans légende** en bas à droite et dans la barre d'outils de la carte : un nouveau joueur ne peut pas deviner leur rôle.
5. **Le journal de quêtes est clair** et bien dans le style ; c'est le bon modèle pour les autres fenêtres.

Ces cinq points entrent dans le lot « prise en main ».

## Le livre sort le 17 novembre

- Dès que tu l'as, dis-moi **sur quel système il repose** (basé sur D&D 5e ou système propre) : cela décide si le module de règles est un travail moyen ou gros.
- Je ne recopierai pas le contenu du livre dans le dépôt, qui est public. La structure te permettra de saisir toi-même races, classes, sorts et objets dans tes fichiers privés du NAS.
- D'ici là, on ne touche à aucune règle.

## Plan révisé

| Lot | Contenu | Ce que tu testes |
|---|---|---|
| 0 | Branche `main` unique, bibliothèques à jour, tests automatiques sur GitHub | `npm run partie` sur ton PC : tout fonctionne comme avant |
| 1 | Sauvegardes automatiques, plus d'écrasement silencieux | Un dossier de copies datées apparaît ; une restauration fonctionne |
| 2 | Mot de passe par joueur + option « points de vie » par table | Impossible d'entrer avec le pseudo d'un autre ; l'option change bien qui peut modifier les points de vie |
| 3 | Images et sons réservés aux connectés | Une adresse d'image ouverte en navigation privée est refusée |
| 4 | Serveur longue durée (sessions conservées) | Redémarrage du serveur en pleine partie sans se reconnecter |
| 5 | Installation sur le NAS + bouton de mise à jour | Tu installes en suivant le guide ; la table s'ouvre sur ton réseau local |
| 6 | Domaine, tunnel, filtre par e-mail | Depuis ton téléphone en 4G : code par e-mail puis le VTT |
| 7 | Partie d'essai à 7 | Fluidité, notamment en peignant le brouillard |
| 8 | **Prise en main et lisibilité** : visite guidée, raccourcis, « c'est ton tour », cadres du groupe, taille des textes, espace de la carte | Un joueur découvre l'outil sans explication |
| 9 | Scènes préparées avec leur brouillard | Basculer entre deux scènes sans rien perdre |
| 10 | Vision automatique simple (niveau 2) | Le brouillard s'ouvre autour des héros |
| 11 | Musique et ambiance | Tous entendent, chacun règle son volume |
| 12 | Module de règles remplaçable | Rien ne change à l'écran ; un combat complet fonctionne |

Le lot 8 ne dépend pas du NAS : il peut passer avant les lots 5 à 7 si tu préfères voir un changement à l'écran plus tôt. Le lot 12 peut remonter dès que le système du livre est connu.

---

# Suivi — lot 0 livré (14 novembre 2026)

**Fait, sur la branche `claude/bold-mendel-k31nk5`** (en attente de ta validation avant de devenir `main`) :

- Sprint 11, travail NAS et fichier de consignes réunis en une seule version. Les 4 fichiers en conflit ont été résolus en gardant les deux apports.
- Les 3 bibliothèques vulnérables sont mises à jour : plus aucune faille connue signalée.
- Vérification automatique ajoutée sur GitHub (tests + compilation à chaque envoi).
- Guide NAS marqué « brouillon » ; son paragraphe sur l'ancienne page `/test/`, qui n'existe plus, est retiré.
- Vérifié : 164 tests réussis, compilation réussie, connexion joueur avec code de table et connexion MJ testées sur le serveur réuni.

**Contrôles NAS complétés**

- DSM 7.4.1 : convient. Cela corrige une information de l'audit : DSM 7.3 n'était donc pas la dernière version installable sur ce modèle.
- Mémoire : 137 Mo libres + 173 Mo de cache récupérable, soit environ 300 Mo disponibles. Le VTT (~100 Mo) et le tunnel (quelques dizaines de Mo, **à mesurer**) tiennent, mais sans grande marge : à surveiller au lot 5, et éviter d'ajouter d'autres paquets gourmands sur le NAS.

**Corrections à mon jugement sur l'interface** (d'après tes précisions) : la carte se zoome, les cadres étaient en mode raid (le mode groupe existe), et les icônes ont une infobulle au survol. Ces trois remarques sont retirées ; restent la taille des textes et la découverte des raccourcis, à revoir au lot « prise en main ».

**Ordre confirmé** : lots 1 à 7 (sécurité puis NAS), ensuite prise en main, scènes, vision niveau 2 puis niveau 3.

---

# Suivi — lot 1 livré (25 novembre 2026)

**Lot 0** validé par l'utilisateur sur son PC, puis publié comme branche `main` (vérification GitHub au vert).

**Lot 1 — filet de sécurité des données**, sur la branche `claude/bold-mendel-k31nk5`, en attente de validation :

- Copie de secours datée de toutes les tables **à chaque lancement**, avant tout chargement, puis **chaque heure** si la partie a changé. Les 30 plus récentes sont gardées. Nouveau dossier `sauvegardes/` à côté de `parties/` (déplaçable avec `VTT_ASSETS_SAUVEGARDES`).
- `npm run restaurer` liste les copies ; `npm run restaurer -- 3` revient à la copie n°3. Refuse si le serveur tourne ; prend d'abord une copie « avant-restauration ».
- Un fichier abîmé (carte, quêtes, carnets, combat) est **déplacé dans `abimes/`** au lieu d'être écrasé. Une fiche ou une table abîmée est ignorée sans être touchée. Le MJ voit un message rouge dans la discussion, à chaque lancement tant que `abimes/` n'est pas vidé.
- Guide : `docs/SAUVEGARDES.md`.
- Vérifié : 173 tests (9 nouveaux), compilation, essai réel avec un vrai serveur (carte abîmée mise de côté, alerte visible dans le navigateur du MJ, restauration refusée serveur allumé, restauration réussie serveur arrêté).

**Correction de C3 dans l'audit** : un fichier illisible n'était pas seulement « ignoré puis écrasé » ; le code le prenait carrément pour un fichier absent. C'est corrigé.

**Reporté, en connaissance de cause** : les migrations de format pour la carte, les quêtes et les carnets (prévues dans l'audit). Elles ne servent qu'au jour où l'un de ces formats change ; d'ici là, la mise de côté et les copies empêchent toute perte. À ajouter avec le premier changement de format concerné (règle déjà écrite dans `CLAUDE.md`).

**Limite** : ces copies sont sur le même disque que la partie. La copie hors du NAS (Hyper Backup vers Google Drive) viendra au lot 5.

---

# Suivi — lot 2 livré (25 novembre 2026)

**Lot 1** validé par l'utilisateur, publié sur `main`.

**Lot 2 — comptes joueurs et réglage des PV**, sur `claude/bold-mendel-k31nk5`, en attente de validation :

- **Mot de passe personnel** : choisi à la première connexion (6 caractères min.), exigé ensuite. Enregistré sous forme d'empreinte (scrypt), jamais en clair, dans `parties/comptes.json`, copié avec les sauvegardes. Corrige C2 (usurpation de pseudo).
- **Pseudos du MJ réservés** (« MJ », « Maître du Jeu »…) : corrige M2.
- **Anti force brute** étendu aux mots de passe joueurs (5 essais par adresse, 15 min) ; 50 comptes au plus (M6, en partie).
- **Mot de passe oublié** : bouton dans le menu MJ d'un personnage joueur (clic droit), avec confirmation.
- **Réglage de table « PV par les joueurs »** (bouton cœur de la barre du MJ), éteint par défaut. Éteint : seul le MJ modifie à la main PV, ressources et états ; allumé : chaque joueur a un bloc « Mes PV » dans sa fiche. Les effets calculés par le serveur (sorts, attaques, repos) ne sont pas concernés. Corrige I8 pour les PV.
- Le « code de table » (`VTT_CODE_TABLE`) de l'ancienne branche NAS reste possible, en champ séparé.
- Vérifié : 182 tests, compilation, essai réel dans le navigateur (création du mot de passe, usurpation refusée, pseudo réservé refusé, interrupteur du MJ qui fait apparaître/disparaître le bloc PV en direct chez le joueur, dégâts appliqués, réinitialisation depuis le menu MJ).

**Constat en passant** : avant ce lot, l'interface ne donnait aucun bouton de PV aux joueurs, mais le serveur acceptait leurs demandes. C'était une porte de triche invisible ; elle est fermée par défaut.

**Limites assumées** :
- N'importe qui ayant le lien peut encore créer un **nouveau** pseudo. Le filtre par e-mail (lot 6) fermera cette porte.
- Après une réinitialisation, le premier qui se connecte avec ce pseudo choisit le mot de passe : le MJ doit prévenir le joueur rapidement.
- Les personnages existants n'ont pas de compte : le premier qui se connecte avec leur pseudo le revendique. Sans conséquence ici (personnages d'essai).

---

# Suivi — lot 3 livré (25 novembre 2026)

**Lot 2** validé par l'utilisateur, publié sur `main`.

**Lot 3 — images et sons réservés aux personnes connectées**, sur `claude/bold-mendel-k31nk5`, en attente de validation :

- À la connexion, le serveur pose un **cookie** (copie du jeton, `httpOnly`, `sameSite=strict`, `secure` en https, 12 h). Le navigateur le présente tout seul pour chaque image.
- **Cartes, jetons, portraits, icônes et sons** : refusés (401) sans cookie valide. Un joueur expulsé ou un serveur redémarré invalide aussitôt l'accès.
- Ces réponses sont marquées `private` : un intermédiaire comme Cloudflare ne doit jamais les garder en cache et les resservir à un inconnu. Point important pour le lot 6.
- **Restent ouverts** : textures de l'interface et polices (l'écran de connexion en a besoin, elles ne révèlent rien de la partie).
- Vérifié : 184 tests (2 nouveaux), compilation, essai réel (inconnu refusé sur carte, son et portrait ; joueur connecté qui voit la carte, aussi après F5 ; cookie d'un expulsé refusé).

**Ce que le lot ne fait pas (choix validé)** : un joueur connecté peut toujours retrouver l'image entière de la carte dans son navigateur. La réponse prévue est la vision par joueur (scènes et champ de vision, lots 9 et 10), pas un découpage de la carte côté serveur.

**I2 (images de Blizzard)** : réglé pour la partie ; les textures d'interface restent accessibles sans connexion, ce qui sera couvert par le filtre par e-mail du lot 6.

---

# Suivi — lot 4 livré (25 novembre 2026)

**Lot 4 — serveur longue durée**, sur `claude/bold-mendel-k31nk5`, avec le lot 3, en attente de validation des deux :

- Les sessions sont notées dans `parties/sessions.json` sous forme d'**empreintes** (SHA-256) : le fichier ne permet pas d'entrer. Après un redémarrage, chacun revient en jeu tout seul (corrige I7). Un joueur expulsé ne revient pas.
- Fichier de sessions abîmé : sans gravité, chacun se reconnecte.
- Ménage toutes les 10 minutes des jetons expirés et des vieux compteurs d'échecs (corrige M4).
- Plantage imprévu : écriture d'urgence de tout ce qui attend en mémoire avant l'arrêt (corrige M5).
- Vérifié : 187 tests (3 nouveaux), compilation, essai réel (serveur arrêté puis relancé pendant qu'un joueur était en jeu : bandeau « reconnexion », retour en jeu sans mot de passe, carte toujours accessible).

**Non testé en réel** : l'écriture d'urgence sur plantage (il faudrait provoquer un vrai plantage ; le mécanisme est court et repose sur la même fonction que l'arrêt normal, elle testée).

**Toujours en mémoire seulement** : la liste des joueurs expulsés (un expulsé peut revenir après un redémarrage, avec son mot de passe) et les jets de dés en attente de validation.

---

# Suivi — lot 5 préparé (25 novembre 2026)

**Lots 3 et 4** validés par l'utilisateur, publiés sur `main`. Domaine choisi : `exopala.com` chez Cloudflare.

**Lot 5 — installation sur le NAS (réseau local)**, publié sur `main` sans attendre de test, par nécessité : la branche `deploiement` dont le NAS a besoin n'est fabriquée qu'à partir de `main`. Seul le texte de la bannière de démarrage change côté PC.

- **GitHub compile pour le NAS** (`.github/workflows/deploiement.yml`) : à chaque version de `main`, tests puis compilation, puis publication sur la branche `deploiement` avec l'interface déjà compilée. Le NAS (~300 Mo libres) n'a jamais à compiler.
- **Scripts NAS** (`scripts/nas-*.sh`) :
  - `nas-installer.sh` vérifie Node.js et git, installe les bibliothèques et demande le mot de passe du MJ (`.env` créé en droits 600).
  - `nas-demarrer.sh` relance la table si elle s'arrête et refuse un double lancement.
  - `nas-arreter.sh` arrête proprement.
  - `nas-mettre-a-jour.sh` télécharge, met en pause, installe et vérifie ; il revient tout seul à l'ancienne version en cas d'échec.
  - Aucune dépendance à `pgrep`/`pkill` (non garantis sur DSM). L'outil de tunnel et le cache npm sont rangés dans `.outils/`.
- Le serveur reconnaît un dossier de NAS (`/volume1/...`) : plus d'alerte « dossier cloud ». La bannière n'affiche plus l'ancienne page `/test/`, et n'affiche plus de lien réseau quand `VTT_HOTE=127.0.0.1`.
- **Guide réécrit** : `docs/NAS-SYNOLOGY.md` (sécurisation, utilisateur `vtt`, deux dossiers partagés, copie des données, SSH une seule fois, tâches planifiées, mise à jour, Hyper Backup vers Google Drive).
- Vérifié : 188 tests, compilation, et une **répétition générale sur un faux NAS** :
  - installation, mot de passe demandé au clavier ;
  - démarrage et double lancement refusé ;
  - mise à jour réussie (moins de 10 s) ;
  - version volontairement cassée refusée, l'ancienne remise toute seule ;
  - arrêt propre.

**À vérifier sur le vrai NAS** :
- `git` fourni par Git Server ;
- une tâche « au démarrage » peut tourner en permanence ;
- mémoire réellement utilisée ;
- chemin `/volume1`.

---

# Suivi — lot 5 installé, lot 6 préparé (26 novembre 2026)

**Lot 5** installé par l'utilisateur sur le vrai NAS : la table s'affiche sur le réseau local ; mémoire à 50 % (contre 49 % avant la table), processeur à 1 %.

Leçons de l'installation réelle :
- Git Server doit être **démarré**.
- Le dossier partagé doit exister **avant** le `git clone` : un `sudo git clone` crée sinon un dossier ordinaire, inaccessible à l'utilisateur de la table.
- L'utilisateur a été créé en `VTT`, et les majuscules comptent.
- Une tâche Cloud Sync **bidirectionnelle** Google Drive ↔ `jdr`, venue de l'ancien guide, était active : suppression conseillée, remplacée par Hyper Backup.
- Le dossier `icones` était arrivé sous le nom `icones (1)`.

**Lot 6 — accès à distance**, préparé et publié :
- `scripts/nas-acces-distant.sh` :
  - demande le jeton (masqué) et vérifie qu'il est bien formé ;
  - demande l'adresse ;
  - écrit `.env` (droits 600) et passe `VTT_HOTE=127.0.0.1` ;
  - relance la table et attend le tunnel ;
  - l'option `retirer` permet de revenir en arrière.
- Le jeton est passé à `cloudflared` par variable d'environnement (`TUNNEL_TOKEN`), plus par la ligne de commande où il était visible des autres comptes du NAS. Vérifié en lisant les arguments du processus. Ajout de `--no-autoupdate`.
- Guide, seconde partie (étapes 10 à 13) : filtre Cloudflare Access par e-mail **avant** d'ouvrir la route, route du tunnel, activation, essai en 4G.
- Vérifié sur le faux NAS :
  - jeton mal copié refusé ;
  - configuration écrite ;
  - réseau local fermé ;
  - le tunnel réessaie de plus en plus espacé avec un jeton invalide.

Le vrai tunnel n'a pas pu être essayé ici (pas de vrai jeton).

---

# Suivi — lot 6 en service (26 novembre 2026)

La table est **en ligne à `https://table.exopala.org`**, derrière Cloudflare Access : code par e-mail (One-time PIN), policy `joueurs`. Vérifié par l'utilisateur en navigation privée : le code arrive et la connexion à la table fonctionne.

Leçons, reportées dans le guide :
- Le domaine acheté est en `.org` : le script ne propose plus d'adresse par défaut.
- « Failed to add published application » : erreur sans cause affichée (pistes : `/` final dans l'URL, route ou enregistrement DNS déjà présent).
- One-time PIN doit d'abord être ajouté comme méthode de connexion du compte, sinon seule « Cloudflare » est proposée.
- Une ligne « Private IP » vide ou l'isolation activée empêche d'enregistrer l'application.
- Le navigateur habituel garde un accès en mémoire : toujours vérifier en navigation privée.

**Reste à vérifier** :
- une vraie partie par l'adresse publique (cookies `secure` et temps réel derrière Cloudflare) ;
- la mémoire avec `cloudflared` ;
- le redémarrage du NAS avec le tunnel ;
- la suppression de la tâche Cloud Sync ;
- `icones (1)` renommé en `icones` ;
- le premier résultat d'Hyper Backup.

---

# Suivi — création de personnage, étape 1 : peuples, classes, lore (26 novembre 2026)

Source : livre *D&D World of Warcraft* (chapitres 1 et 2, « Creating a Character »). **Le dépôt étant public, aucun texte du livre n'y est versé** : les fichiers tirés du livre sont remis à l'utilisateur, qui les dépose dans `\\NAS\jdr\referentiel`.

Choix validés par l'utilisateur :
- traduction avec la nomenclature française officielle de WoW ;
- la faction (Alliance / Horde) se choisit en premier ; un peuple sans faction propre est proposé des deux côtés ;
- classes héroïques non grisées, seulement signalées (niveau 3 ou accord du MJ) ;
- restrictions de lore du livre, levées par le MJ (outil **⚑ Lore libre**) puis case à cocher par le joueur ;
- spécialisation au choix ;
- historiques (règles 2024 : +2/+1 ou +1/+1/+1, don d'origine) : 4 historiques du SRD pour l'instant, l'utilisateur donnera les 12 autres ;
- l'Humain choisit un don d'origine en plus, y compris les 3 dons humains du livre ;
- ressources du livre : étape à part, après l'étape 5.

Réalisé :
- référentiel : options de peuple (lignée, nation, taille...), type de créature, renommée de départ, historiques, dons, spécialisations, classe D&D d'origine, restriction de lore ;
- fiche version 7 : bloc `origine` (historique, options, spécialisation, sous-classe, dons, taille, type, apparence, renommée), migration des anciennes fiches (`origine` vide) ;
- arbitrage serveur de chaque choix, lore libre seulement si le MJ l'autorise à la table ;
- exemples publics réécrits : 5 espèces, 4 historiques, 6 dons du SRD 5.2 (mention CC-BY), 13 classes WoW avec leurs règles de base ;
- tests : 195, tous verts ; essai réel dans le navigateur avec les données du livre (Pandaren Huojin de la Horde, Évocateur humain en lore libre, don humain supplémentaire).

Conséquence à connaître : les anciennes clés `barbare`, `barde`, `ensorceleur` et les peuples provisoires (`elfe-de-sang`, `tauren`... selon le fichier) disparaissent du référentiel d'exemple. Les personnages de test qui les utilisent sont à recréer.

**Reste à vérifier** : les noms marqués « à vérifier » dans les fichiers du livre ; l'affichage avec les vrais portraits et icônes du NAS.

---

# Suivi — création de personnage, étape 2 : caractéristiques aux dés (26 novembre 2026)

Choix validés par l'utilisateur :
- méthode du Manuel des joueurs : six fois 4d6, on garde les 3 meilleurs dés ;
- le joueur place ses six valeurs librement ;
- toute la table voit les dés (message dans la discussion) ;
- relance seulement si le MJ l'autorise ; le joueur garde le meilleur des deux tirages (total le plus haut) ;
- le MJ choisit, pour sa table, les méthodes permises (tableau standard, achat de points, dés).

Réalisé :
- `server/src/regles/tirage.js` : règle pure, testée (`server/test/tirage.test.js`) ;
- le tirage est lancé et gardé par le serveur, dans la table (`tirages`) : recharger la page ne permet pas de relancer ; il est retiré quand le personnage est créé ;
- nouvelle fenêtre MJ **⚅ Création** : cases des méthodes permises, liste des tirages en cours, bouton « Autoriser une relance » ;
- les joueurs à l'écran de création reçoivent désormais en direct les réglages de la table (méthodes, lore libre) ;
- correction d'un défaut de l'étape 1 : changer un réglage de table (ex. « PV par les joueurs ») remettait les autres (ex. « Lore libre ») à leur valeur par défaut ;
- tests : 200, tous verts ; essai réel dans le navigateur (tirage, relance autorisée par le MJ, meilleur tirage gardé, retrait de la méthode par le MJ, création).
