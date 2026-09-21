# Comment mes joueurs se connectent ?

Ton PC est le serveur. Trois cas, du plus simple au plus general.

## 1. Vous etes sur le meme reseau (soiree sur place)
Donne-leur l'adresse affichee au demarrage, du type `http://192.168.1.20:3000`.
Rien a installer.

## 2. Vous jouez a distance — solution recommandee : un tunnel
Un tunnel publie temporairement ton serveur local derriere une adresse web,
sans toucher a ta box ni exposer ton PC.

```
cloudflared tunnel --url http://localhost:3000
```

La commande affiche un lien `https://xxx.trycloudflare.com` : c'est le lien a
coller dans Discord. Il est jetable, il meurt quand tu fermes la fenetre.

Alternatives equivalentes : `ngrok http 3000`, ou un reseau prive Tailscale si
le groupe joue souvent ensemble.

## 3. Ouverture de port sur la box
Possible (redirection du port 3000 vers ton PC) mais deconseille : ton PC devient
joignable depuis tout Internet, et l'adresse change a chaque redemarrage de box.

## Securite
Le mot de passe MJ de `config.json` protege l'ecran du Maitre du Jeu. Les joueurs
n'ont acces qu'a ce que le serveur leur envoie : les zones cachees par le
brouillard de guerre ne quittent jamais ton PC.
