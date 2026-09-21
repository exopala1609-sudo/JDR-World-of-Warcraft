# Polices d'ecriture

Les polices officielles de World of Warcraft (**Morpheus**, **Friz Quadrata TT**,
**Expressway**) appartiennent a Blizzard : elles ne peuvent pas etre livrees avec
le projet. Deux options :

1. **Usage prive (recommande pour ta table)** : copie les fichiers `.TTF` depuis
   ton installation du jeu (`World of Warcraft/_retail_/Fonts/`) dans ce dossier,
   puis declare-les dans `client/src/styles/global.css` avec `@font-face`.
2. **Alternatives libres** : `Cinzel` (titres) et `EB Garamond` / `Cormorant`
   (textes) donnent un rendu tres proche et sont redistribuables.

Tant qu'aucun fichier n'est depose, l'interface retombe automatiquement sur la
pile de secours definie dans `--police-titre` / `--police-texte`.
