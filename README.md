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
npm run partie   # prepare l'interface, demarre, affiche (et copie) le lien pour les joueurs
```
Puis ouvre **http://localhost:3000/** : l'ecran de connexion World of Warcraft.
C'est la porte UNIQUE, pour les joueurs comme pour toi : en bas de l'ecran, le
lien discret **« Connexion Maitre du Jeu »** demande ton mot de passe. Tu arrives
alors sur la meme interface que les joueurs, avec tes outils en plus (sur ta
barre d'actions en bas, touches 1 a 9 ; clic droit sur un pion ou un cadre ;
bouton carte sur la minicarte).

Details et solutions de secours : [docs/ACCES-JOUEURS.md](docs/ACCES-JOUEURS.md).
Pour developper : `npm run dev` (interface sur http://localhost:5173 ; le port
3000 y renvoie tout seul).

Les tests automatiques des regles se lancent avec :
```bash
npm test
```
Architecture detaillee : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Ecrire ses objets, sorts et auras : [docs/COMPENDIUM.md](docs/COMPENDIUM.md).
Modifier les races, classes et regles de creation : [docs/REFERENTIEL.md](docs/REFERENTIEL.md).
Polices, portraits, icones : [docs/PERSONNALISER.md](docs/PERSONNALISER.md).
Pour des joueurs hors de ton reseau, voir [docs/ACCES-JOUEURS.md](docs/ACCES-JOUEURS.md).
Hebergement permanent sur un NAS Synology avec nom de domaine : [docs/NAS-SYNOLOGY.md](docs/NAS-SYNOLOGY.md).

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
| `exemples/` | Donnees de test (compendium, referentiel), copiees au premier lancement |
| `donnees-mj/` | Ancien dossier de secours (n'est plus utilise : `VTT_ASSETS` est obligatoire) |
| `docs/` | Notes d'utilisation |
