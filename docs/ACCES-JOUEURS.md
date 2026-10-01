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

## 3. Ouverture de port sur la box
Possible, mais deconseille : ton PC devient joignable en permanence depuis tout
Internet, et l'adresse change a chaque redemarrage de la box.

## Securite quand le serveur est expose
- **Mot de passe MJ obligatoire** : tant que `VTT_MOTDEPASSE_MJ` vaut
  `change-moi` (ou fait moins de 6 caracteres), l'acces MJ est desactive.
- **Anti force brute** : 5 mauvais mots de passe MJ bloquent l'adresse 15 minutes.
- **Les joueurs n'ont qu'un pseudo.** Quelqu'un qui connait le lien ET le pseudo
  d'un joueur peut prendre sa place. Ne partage le lien que sur votre Discord,
  et coupe le tunnel (Ctrl + C) a la fin de la seance : l'adresse meurt avec lui.
- Les fiches de PNJ, les lancers secrets du MJ, le compendium et les sauvegardes
  ne sont jamais envoyes aux navigateurs des joueurs.
- Les pions de monstres caches (ou tapis dans le brouillard) ne sont jamais
  envoyes aux joueurs. **En revanche, l'image de la carte leur est envoyee en
  entier** : le brouillard la masque a l'affichage, mais un joueur qui ouvre
  l'adresse de l'image dans son navigateur voit tout le donjon.
