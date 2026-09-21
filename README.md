# VTT "World of Warcraft" — Donjons & Dragons 5e

Table de jeu virtuelle en francais, hebergee sur le PC du Maitre du Jeu, avec
l'ergonomie et l'ambiance visuelle de World of Warcraft. Les joueurs se
connectent depuis leur navigateur, sans rien installer.

## Prerequis
[Node.js 20 ou plus](https://nodejs.org) installe sur le PC du MJ.

## Installation (une seule fois)
```bash
npm install
```
Cette commande cree `config.json` (a personnaliser) et les dossiers `donnees-mj/`.

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
Dans `config.json`, la section `dossiers` accepte n'importe quel chemin Windows
(`"cartes": "D:\\JDR\\Cartes"`). Rien n'est copie ni uploade : le serveur lit
directement sur ton disque et n'envoie aux joueurs que ce qu'ils doivent voir.

## Organisation du projet
| Dossier | Role |
| --- | --- |
| `server/` | Serveur local : pages, medias du disque, temps reel |
| `client/` | Interface WoW (React + TypeScript), verrouillee en 2560x1440 |
| `shared/` | Vocabulaire et regles D&D 5e communs aux deux cotes |
| `donnees-mj/` | Tes cartes, jetons et fichiers de compendium |
| `docs/` | Notes d'utilisation |
