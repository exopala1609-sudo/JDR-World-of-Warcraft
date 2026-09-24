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
npm run dev      # developpement : interface WoW sur http://localhost:5173
```
```bash
npm run partie   # joueurs a distance : affiche (et copie) le lien a leur envoyer
```
Details et solutions de secours : [docs/ACCES-JOUEURS.md](docs/ACCES-JOUEURS.md).

## Banc de test
Une page brute (sans mise en forme) permet de tout verifier : connexion MJ /
joueur, tables, personnages, points de vie, ressources, repos, compendium,
inventaire, etats, combat, et la carte (grille, pions, brouillard), en temps reel.
```
http://localhost:3000/test/
```
Les tests automatiques des regles se lancent avec :
```bash
npm test
```
Architecture detaillee : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Ecrire ses objets, sorts et auras : [docs/COMPENDIUM.md](docs/COMPENDIUM.md).
Polices, portraits, icones : [docs/PERSONNALISER.md](docs/PERSONNALISER.md).
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
| `server/` | Serveur local : acces, donnees JSON, regles D&D, temps reel |
| `client/` | Interface World of Warcraft (React + TypeScript) |
| `shared/` | Vocabulaire temps reel et regles D&D 5e communs aux deux cotes |
| `exemples/` | Donnees de test (compendium), copiees au premier lancement |
| `donnees-mj/` | Dossier de secours quand `VTT_ASSETS` n'est pas configure |
| `docs/` | Notes d'utilisation |
