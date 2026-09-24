# Comment mes joueurs se connectent ?

Ton PC est le serveur, et il ecoute sur le **port 3000**. Tout le probleme est
de rendre ce port joignable par tes amis. Trois situations.

## 1. Meme reseau (soiree sur place, meme box)
Donne l'adresse affichee au demarrage, par exemple `http://192.168.1.30:3000/test/`.
Rien a installer. Au premier lancement, autorise Node.js dans le pare-feu
Windows (case **Reseaux prives**).

## 2. A distance, sans rien installer chez les joueurs : un tunnel
Un tunnel est un intermediaire sur Internet : il donne une adresse publique en
`https://` et fait suivre le trafic jusqu'a ton PC. Ta box n'est pas modifiee.
**Le tunnel doit viser le port 3000**, meme pendant `npm run dev`.

### ngrok (recommande pour commencer)
1. Cree un compte gratuit sur https://ngrok.com et installe ngrok.
2. Une seule fois, colle ta cle (visible sur ton tableau de bord ngrok) :
   ```
   ngrok config add-authtoken <ta-cle>
   ```
3. A chaque partie, dans une **deuxieme** fenetre de commandes :
   ```
   ngrok http 3000
   ```
4. Copie l'adresse `https://....ngrok-free.app` affichee, ajoute `/test/`, et
   envoie-la sur Discord.

La version gratuite affiche une page d'avertissement ngrok a la premiere visite :
les joueurs cliquent sur **Visit Site**, c'est normal.

### Cloudflare (sans compte, adresse jetable)
```
cloudflared tunnel --url http://localhost:3000
```
Donne une adresse `https://xxx.trycloudflare.com`, qui change a chaque lancement.

### Et Tailscale ?
Tailscale cree un reseau prive entre machines, mais **chaque joueur devrait
installer Tailscale**, ce qui contredit ton cahier des charges. Seule exception :
`tailscale funnel 3000`, qui publie une adresse accessible sans installation,
comme ngrok.

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
