# Comment mes joueurs se connectent ?

Ton PC est le serveur, et il ecoute sur le **port 3000**. Tout le probleme est
de rendre ce port joignable par tes amis. Trois situations.

## 1. Meme reseau (soiree sur place, meme box)
Donne l'adresse affichee au demarrage, par exemple `http://192.168.1.30:3000/`.
C'est la MEME adresse pour toi : le Maitre du Jeu entre par le lien discret
« Connexion Maitre du Jeu » en bas de l'ecran de connexion.
Rien a installer. Au premier lancement, autorise Node.js dans le pare-feu
Windows (case **Reseaux prives**).

## 2. A distance : `npm run partie` (recommande)

Une seule commande, a la place de `npm run dev` :
```
npm run partie
```
Le serveur demarre, ouvre tout seul un acces distant via Cloudflare, puis
affiche un encadre :

```
  ************************************************************
   LIEN A ENVOYER A TES JOUEURS :

     https://mots-au-hasard.trycloudflare.com/

   Deja copie ! Colle-le dans Discord avec Ctrl + V.
  ************************************************************
```

Le lien est deja dans ton presse-papiers : **Ctrl + V dans Discord**, c'est tout.
Les joueurs cliquent et arrivent directement sur la page, sans compte, sans
installation et sans page d'avertissement.

A savoir :
- **Premier lancement** : l'outil Cloudflare (~40 Mo) se telecharge tout seul,
  une fois pour toutes (sur chaque PC).
- **Rien a regler** : ni la box, ni le pare-feu (la connexion part de ton PC).
- **Le lien change a chaque partie**, et cesse de fonctionner des que tu fermes
  la fenetre du serveur. C'est aussi une protection : un ancien lien qui
  traine sur Discord ne donne plus acces a rien.
- Service gratuit sans garantie de disponibilite. S'il est en panne, le serveur
  le signale, reste jouable en local, et tu peux passer au plan B.

### Plan B : ngrok
Si Cloudflare est indisponible : cree un compte gratuit sur https://ngrok.com,
installe ngrok, colle une fois ta cle (`ngrok config add-authtoken <ta-cle>`),
puis lance `npm run dev` et, dans une deuxieme fenetre, `ngrok http 3000`.
Inconvenient : la version gratuite affiche une page d'avertissement aux joueurs
(ils doivent cliquer sur **Visit Site**).

### Et Tailscale ?
Tailscale cree un reseau prive entre machines, mais **chaque joueur devrait
installer Tailscale**, ce qui contredit le cahier des charges. Seule exception :
`tailscale funnel 3000`, qui publie une adresse accessible sans installation.

## 2 bis. Adresse fixe, table toujours allumee
Voir [NAS-SYNOLOGY.md](NAS-SYNOLOGY.md) : la table tourne sur le NAS, avec ton
nom de domaine et un code de table pour les joueurs.

## 3. Ouverture de port sur la box
Possible, mais deconseille : ton PC devient joignable en permanence depuis tout
Internet, et l'adresse change a chaque redemarrage de la box.

## Mots de passe des joueurs

- **Premiere connexion** : le joueur tape son pseudo et **choisit** un mot de
  passe (6 caracteres minimum). Il est enregistre aussitot.
- **Ensuite** : ce pseudo n'entre plus qu'avec ce mot de passe.
- **Mot de passe oublie** : clic droit sur son personnage (ou son cadre) >
  **Mot de passe oublie**, puis confirme. A sa prochaine connexion, le joueur
  en choisit un nouveau. Previens-le vite : d'ici la, n'importe qui pourrait
  choisir ce mot de passe a sa place.
- Les mots de passe ne sont **jamais** enregistres en clair : le fichier
  `parties/comptes.json` ne contient que leurs « empreintes », qui permettent
  de reconnaitre un mot de passe sans pouvoir le retrouver. Il est copie avec
  les sauvegardes (`docs/SAUVEGARDES.md`).
- Si `VTT_CODE_TABLE` est defini dans `.env`, un champ « Code de la table »
  s'ajoute : c'est un code commun, en plus du mot de passe personnel.

## Qui modifie les points de vie ?

Par defaut, **seul le MJ** modifie a la main les PV, ressources et etats (clic
droit sur un personnage). Les degats et soins calcules par le jeu (sorts,
attaques, repos) s'appliquent toujours normalement.

Le bouton **coeur** de la barre d'outils du MJ change ce reglage pour la table
en cours : allume, chaque joueur voit un bloc **Mes PV** dans sa fiche (touche
C) pour noter lui-meme ses degats et soins. Il ne peut jamais toucher au
personnage d'un autre.

## Securite quand le serveur est expose
- **Mot de passe MJ obligatoire** : tant que `VTT_MOTDEPASSE_MJ` vaut
  `change-moi` (ou fait moins de 6 caracteres), l'acces MJ est desactive.
- **Anti force brute** : 5 mauvais mots de passe (MJ ou joueur) depuis la meme
  adresse la bloquent 15 minutes.
- **Chaque joueur a son mot de passe** (voir plus bas) : personne ne peut prendre
  le pseudo d'un autre pour jouer son personnage ou lire ses notes. En revanche,
  quiconque connait le lien peut se creer un NOUVEAU pseudo : ne partage le lien
  que sur votre Discord (l'acces filtre par e-mail du NAS fermera cette porte).
- Les pseudos du MJ (« MJ », « Maitre du Jeu »...) sont reserves.
- Les fiches de PNJ, les lancers secrets du MJ, le compendium et les sauvegardes
  ne sont jamais envoyes aux navigateurs des joueurs.
- **Images et sons reserves aux personnes connectees** : cartes, jetons,
  portraits, icones et sons ne sont envoyes qu'a un navigateur connecte
  (joueur ou MJ). Quelqu'un qui devine l'adresse d'une image recoit un refus ;
  un joueur expulse perd l'acces aussitot. Ces fichiers ne sont jamais gardes
  en memoire par un intermediaire (Cloudflare). Les textures de l'interface et
  les polices restent ouvertes : l'ecran de connexion en a besoin.
- Les pions de monstres caches (ou tapis dans le brouillard) ne sont jamais
  envoyes aux joueurs. **En revanche, l'image de la carte est envoyee en entier
  aux joueurs connectes** : le brouillard la masque a l'affichage, mais un
  joueur qui fouille son navigateur peut voir tout le donjon.
