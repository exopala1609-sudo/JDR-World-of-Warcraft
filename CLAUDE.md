# CLAUDE.md — VTT « World of Warcraft » (D&D 5e)

Table de jeu virtuelle en français, hébergée sur le PC du Maître du Jeu (MJ).
Les joueurs se connectent depuis leur navigateur. Voir `README.md` pour l'installation
et `docs/ARCHITECTURE.md` pour le rôle de chaque fichier.

## Qui est l'utilisateur
Hadrien, pharmacien de formation, **pas développeur**. Explique simplement, avec des
images de la vie courante, sans jargon non expliqué. Indique toujours le chemin exact
des fichiers modifiés. Avance par petites étapes vérifiables.

## Commandes
- `npm install` : installe tout et crée le `.env` de ce poste
- `npm run dev` : développement (interface sur http://localhost:5173, serveur sur :3000)
- `npm test` : tests automatiques des règles (`server/test/*.test.js`)
- `npm run build` : vérifie le TypeScript puis construit l'interface
- `npm run partie` : construit puis lance le serveur avec un lien pour les joueurs distants

## Avant de dire « c'est fini »
1. `npm test` doit passer.
2. `npm run build` doit passer (il contient la vérification TypeScript).
3. Si l'interface a changé, la regarder réellement dans un navigateur.

## Règles du projet
- **Le code et les données sont séparés.** Rien de personnel dans Git : cartes, fiches,
  sauvegardes vivent dans le dossier cloud désigné par `VTT_ASSETS` dans `.env`.
- **Le `.env` ne part jamais sur GitHub** (mot de passe MJ, chemins du poste).
- Le dossier `shared/` est utilisé par le serveur **et** les navigateurs : y mettre
  uniquement du code qui marche des deux côtés.
- Les messages temps réel (Socket.IO) ont leurs noms dans `shared/protocole.js`.
  Ne pas écrire un nom de message « en dur » ailleurs.
- Les règles du jeu (`server/src/regles/`) sont des **fonctions pures** testées.
  Toute nouvelle règle = un test dans `server/test/`.
- La forme des données est vérifiée avec Zod (`server/src/modeles/`). Si on change
  une forme, ajouter une migration dans `modeles/migrations.js` pour les anciennes fiches.
- Interface et noms de variables en français, comme dans le reste du code.

## Ce qui n'est pas encore en place
- Aucun test de l'interface (seulement des règles côté serveur).
- Pas de linter. GitHub relance `npm test` et `npm run build` a chaque envoi
  (`.github/workflows/verification.yml`).
- Les visuels et noms issus de World of Warcraft appartiennent à Blizzard : OK pour
  jouer entre amis, à remplacer avant toute diffusion publique.
