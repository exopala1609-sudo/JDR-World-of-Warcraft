# Copies de secours et restauration

Le serveur prend tout seul des **copies de secours** de tes parties : comme un
appareil photo qui fige l'etat de toutes les tables a un instant donne. Si une
partie est abimee, ou si tu veux revenir en arriere, tu choisis une photo et
le jeu repart de la.

## Quand les copies sont-elles prises ?

- **A chaque lancement du serveur**, avant qu'il ne touche a quoi que ce soit.
- **Toutes les heures** pendant que le serveur tourne, mais seulement si quelque
  chose a change depuis la copie precedente (un serveur allume toute la semaine
  ne remplit pas le disque de copies identiques).

Les **30 plus recentes** sont gardees ; les plus anciennes sont supprimees
automatiquement. Un dossier que tu ranges toi-meme dans `sauvegardes/` (par
exemple `mes-archives`) n'est jamais supprime.

## Ou sont-elles ?

Dans le dossier `sauvegardes/`, a cote de `parties/` :

```
<VTT_ASSETS>/
├── parties/                              la partie en cours
└── sauvegardes/
    ├── 2026-11-25_20h05m33_demarrage/    copie prise au lancement
    ├── 2026-11-25_21h05m33_en-jeu/       copie prise pendant la partie
    └── 2026-11-25_21h40m02_avant-restauration/
```

Chaque copie est un simple dossier : tu peux l'ouvrir dans l'explorateur de
fichiers. La ligne `Copie de secours : ...` du demarrage du serveur te dit
laquelle vient d'etre prise.

Pour le placer ailleurs (un autre disque, par exemple), ajoute dans `.env` :

```ini
VTT_ASSETS_SAUVEGARDES=D:\Sauvegardes-JDR
```

## Revenir a une copie

1. **Arrete le serveur** (Ctrl + C dans sa fenetre).
2. Dans le dossier du projet, affiche la liste des copies :
   ```
   npm run restaurer
   ```
   La n°1 est la plus recente.
3. Choisis un numero et lance par exemple :
   ```
   npm run restaurer -- 3
   ```
4. Relance la partie (`npm run partie`).

Garanties :

- La commande **refuse de fonctionner si le serveur tourne encore** (il
  reecrirait aussitot par-dessus). Si elle refuse alors que tu viens de
  l'arreter, attends une minute et recommence.
- Juste avant de restaurer, elle prend une copie de l'etat actuel, nommee
  `avant-restauration`. Si tu t'es trompe de numero, refais simplement la
  meme operation avec cette copie-la.
- Toutes les tables reviennent a l'etat de la copie. Une table creee apres
  la copie disparait (elle reste dans la copie `avant-restauration`).

## Les fichiers abimes

Un fichier peut s'abimer : conflit de synchronisation du cloud, modification a
la main avec une faute de frappe, coupure de courant au mauvais moment.

Au lancement, le serveur verifie chaque fichier :

| Fichier abime | Ce que fait le serveur |
|---|---|
| `scene.json` (carte, pions, brouillard), `quetes.json`, `notes.json`, `combat.json` | Il le **deplace** dans le dossier `abimes/` de la table, avec la date, puis repart d'un etat vide pour ce fichier. Sans ce deplacement, la premiere action en jeu l'aurait ecrase. |
| Une fiche de personnage | Il la laisse en place et l'ignore. Corrige-la ou restaure une copie, puis relance. |
| `table.json` | Il ignore toute la table, sans rien y ecrire. |

Dans tous les cas, **rien n'est efface**, et le MJ voit un message rouge dans
la discussion en entrant dans la table. Ce message revient a chaque lancement
tant que le dossier `abimes/` de la table n'est pas vide.

Que faire quand ce message apparait :

1. **Le plus simple** : arrete le serveur et restaure la derniere copie prise
   avant l'incident (`npm run restaurer`, voir ci-dessus). La copie
   `demarrage` du lancement concerne contient encore le fichier tel qu'il
   etait avant d'etre mis de cote.
2. **Ou**, si tu sais le faire, ouvre le fichier du dossier `abimes/` dans le
   Bloc-notes, corrige-le, renomme-le avec son nom d'origine (`scene.json`...)
   et remets-le dans le dossier de la table, serveur arrete.
3. Une fois regle, **supprime le contenu du dossier `abimes/`** : le message
   disparait au lancement suivant.

## Une copie hors de cet ordinateur

Ces copies vivent sur le meme disque que la partie : elles protegent contre
une erreur ou un fichier abime, **pas contre la panne du disque ou du NAS**.
Pour cela, il faut une copie ailleurs. Sur le NAS, l'outil Synology
**Hyper Backup** pourra envoyer chaque nuit le dossier des donnees vers
Google Drive : ce sera mis en place avec l'installation sur le NAS.
