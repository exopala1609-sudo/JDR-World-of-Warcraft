# VTT "World of Warcraft" — Donjons & Dragons 5e

Table de jeu virtuelle en francais, hebergee sur le PC du Maitre du Jeu, avec
l'ergonomie et l'ambiance visuelle de World of Warcraft. Les joueurs se
connectent depuis leur navigateur, sans rien installer.

## Prerequis
[Node.js 20 ou plus](https://nodejs.org) installe sur le PC du MJ.

## Installation (a refaire sur chaque ordinateur)
```bash
npm install              # cree le fichier .env de ce poste
npm run detecter-assets  # propose le chemin de ton dossier de cartes/jetons
```
Ouvre ensuite `.env` et renseigne `VTT_ASSETS`. C'est la seule ligne qui change
entre ton PC fixe et ton portable : voir [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Lancer une partie
```bash
npm run dev      # developpement : interface rechargee a chaque modification
```
```bash
npm run build && npm start   # partie reelle : tout est servi par le port 3000
```
Les adresses a partager s'affichent dans la console au demarrage.
Pour des joueurs hors de ton reseau, voir [docs/ACCES-JOUEURS.md](docs/ACCES-JOUEURS.md).

## Ou je mets mes fichiers ?
Dans un dossier unique — y compris un dossier synchronise (Google Drive,
OneDrive) pour jouer indifferemment depuis le fixe ou le portable :

```ini
VTT_ASSETS=G:\Mon Drive\JDR     # .env du PC fixe
VTT_ASSETS=C:\Users\Moi\Mon Drive\JDR   # .env du portable
```

Rien n'est copie ni uploade : le serveur lit directement les fichiers et
n'envoie aux joueurs que ce qu'ils doivent voir. Au demarrage, il verifie
chaque dossier et signale tout chemin errone.

## Organisation du projet
| Dossier | Role |
| --- | --- |
| `server/` | Serveur local : pages, medias du disque, temps reel |
| `client/` | Interface WoW (React + TypeScript), verrouillee en 2560x1440 |
| `shared/` | Vocabulaire et regles D&D 5e communs aux deux cotes |
| `donnees-mj/` | Dossier de secours quand `VTT_ASSETS` n'est pas configure |
| `docs/` | Notes d'utilisation |
