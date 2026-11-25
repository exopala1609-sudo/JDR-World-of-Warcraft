# Configuration d'un poste (PC fixe ou portable)

Tout ce qui change d'un ordinateur a l'autre tient dans **un seul fichier :
`.env`**, a la racine du projet. Il n'est jamais envoye sur GitHub : chaque PC
garde le sien.

## Mise en route sur un nouvel ordinateur

```bash
npm install            # cree automatiquement le .env a partir de .env.exemple
npm run detecter-assets  # cherche ton dossier cloud et propose la bonne ligne
```

Ouvre `.env`, colle le chemin, c'est fini :

```ini
# Sur le PC fixe
VTT_ASSETS=G:\Mon Drive\JDR

# Sur le portable (meme dossier, autre chemin)
VTT_ASSETS=C:\Users\Moi\Mon Drive\JDR
```

**`VTT_ASSETS` est obligatoire, et doit etre un chemin complet** (qui commence
par une lettre de lecteur comme `G:\` ou `C:\`). Tant qu'il est vide, relatif
ou qu'il pointe dans le dossier du projet, le serveur **refuse de demarrer** et
explique quoi corriger. C'est voulu : une partie sauvegardee dans le dossier du
projet resterait sur ce seul PC, invisible depuis l'autre.

Au demarrage, le serveur affiche ou il lit et ecrit les sauvegardes :

```
  Sauvegardes      : G:\Mon Drive\JDR\parties  (Google Drive)
  Donnees chargees : 2 table(s), 5 personnage(s).
```

Si cette ligne n'affiche pas ton dossier cloud, ou si les tables manquent,
arrete tout (`Ctrl + C`) et corrige le `.env` avant de jouer.

## Jouer sur deux PC (fixe et portable)

Les deux PC lisent et ecrivent **le meme dossier cloud**. Seul le chemin qui y
mene peut differer d'un PC a l'autre (d'ou un `.env` par PC).

1. Sur le PC que tu quittes : `Ctrl + C` (tout est ecrit immediatement), puis
   attends que Google Drive / OneDrive indique « a jour ».
2. Sur l'autre PC : lance la partie. La ligne « Sauvegardes » doit montrer ton
   dossier cloud, et « Donnees chargees » le bon nombre de tables.
3. Ne lance jamais la partie sur les deux PC en meme temps (le serveur te
   previent s'il detecte l'autre poste).

Pour trouver le chemin du dossier sur un PC : explorateur de fichiers, ouvre
ton dossier `JDR`, clique dans la barre d'adresse, copie (`Ctrl + C`), colle
dans `.env` apres `VTT_ASSETS=`. Ou lance `npm run detecter-assets`.

### Anciennes parties restees dans le projet

Avant cette regle, un `.env` non rempli envoyait les sauvegardes dans le dossier
`donnees-mj\parties` du projet. Le serveur te le signale au demarrage. Pour les
garder, copie les dossiers `t-xxxxxxxxxx` qu'il contient dans le dossier
`parties` de ton cloud.

## Structure attendue du dossier cloud

```
JDR/                     <- VTT_ASSETS pointe ici
├── cartes/              gros plans de donjons
├── jetons/              images de monstres et de PJ
├── portraits/           visages du groupe
├── compendium/          fichiers de sorts et d'objets (JSON)
├── referentiel/         factions, races, classes, regles de creation (JSON)
├── parties/             sauvegardes ecrites par le serveur
└── sauvegardes/         copies de secours datees (voir docs/SAUVEGARDES.md)
```

Un dossier peut vivre ailleurs que les autres — par exemple les cartes sur un
SSD local pour la vitesse, le reste dans le cloud :

```ini
VTT_ASSETS=G:\Mon Drive\JDR
VTT_ASSETS_CARTES=D:\Cartes-lourdes
```

## Les trois regles du dossier synchronise

Le cloud est parfait pour transporter des fichiers, mais il a trois pieges.
Le code s'en protege deja, voici ce qu'il fait et ce qui reste de ton ressort.

### 1. Un seul serveur a la fois
Si le fixe et le portable lancent la partie en meme temps, les deux ecrivent
dans les memes sauvegardes et le cloud produit des « fichiers en conflit ».

*Le code :* depose un verrou dans `parties/` et **affiche un avertissement**
au demarrage si une partie tourne deja sur l'autre poste.
*Toi :* ferme la partie sur un PC avant de l'ouvrir sur l'autre.

### 2. Aucune sauvegarde a moitie ecrite
Un cloud peut synchroniser un fichier pendant que le serveur l'ecrit.

*Le code :* ecrit toujours dans un fichier temporaire puis le renomme — une
operation instantanee. Le cloud ne voit donc jamais qu'un fichier complet.

### 3. Fichiers « a la demande »
OneDrive et Google Drive affichent par defaut des **raccourcis** : le fichier
n'est telecharge qu'a la premiere ouverture. En pleine partie, cela donne une
carte qui met dix secondes a s'afficher.

*Le code :* detecte que ton dossier est dans un cloud et te le rappelle au
demarrage.
*Toi :* clic droit sur le dossier `JDR` → **« Toujours conserver sur cet
appareil »** (OneDrive) ou **« Disponible hors connexion »** (Google Drive).

## Toutes les variables

| Variable | Role | Defaut |
| --- | --- | --- |
| `VTT_ASSETS` | Dossier racine de tes fichiers (chemin complet, OBLIGATOIRE) | aucun : le serveur refuse de demarrer |
| `VTT_ASSETS_CARTES` … `_PARTIES`, `_SAUVEGARDES` | Chemin d'un sous-dossier place ailleurs | dans `VTT_ASSETS` |
| `VTT_NOM_PARTIE` | Titre affiche dans l'interface | `Ma campagne` |
| `VTT_PORT` | Port du serveur | `3000` |
| `VTT_MOTDEPASSE_MJ` | Protege l'ecran du Maitre du Jeu | `change-moi` |
| `VTT_NOM_POSTE` | Nom du PC dans les messages et le verrou | nom Windows |
