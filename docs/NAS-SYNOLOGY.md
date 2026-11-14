# Heberger la table sur le NAS Synology (DS218play)

> **Brouillon, pas encore valide sur le NAS.** Ce guide sera reecrit et teste
> pas a pas (voir le plan dans `AUDIT_VTT.md`, lots 5 et 6). Ne l'applique pas
> tel quel : la protection des comptes joueurs et des images doit passer avant.

Objectif : la table tourne en permanence sur le NAS, a une **adresse fixe**
(ex. `https://table.ton-domaine.com`), sans ouvrir aucun port sur la box et
sans exposer l'interface d'administration du NAS.

```
Joueurs ──https──> Cloudflare ──tunnel sortant──> NAS (cloudflared) ──> table (127.0.0.1:3000)
```

Le NAS **appelle** Cloudflare ; Internet ne peut jamais appeler le NAS
directement. Seule la table est visible de l'exterieur, pas DSM.

Duree totale : environ 1 h 30 la premiere fois.

---

## Etape 1 — Proteger le NAS (avant tout le reste)

Dans **Panneau de configuration** :

1. **Mise a jour et restauration** : installe la derniere version de DSM, et
   regle les mises a jour automatiques sur « correctifs importants ».
2. **Utilisateur et groupe** :
   - desactive le compte `admin` s'il existe encore (garde ton propre compte
     administrateur, avec un mot de passe long) ;
   - onglet **Avance** > active la **verification en 2 etapes** pour les
     administrateurs (application Google Authenticator ou equivalent) ;
   - cree un utilisateur **`vtt`**, **non administrateur**, sans acces aux
     applications. C'est lui qui fera tourner la table : si un jour la table
     etait piratee, l'intrus n'aurait que les droits de cet utilisateur.
3. **Acces externe** :
   - **QuickConnect** : desactive-le si tu ne t'en sers pas. Si tu l'utilises
     (Synology Drive a distance, par exemple), garde-le mais limite-le :
     **Parametres avances > Autorisations**, ne coche que les applications
     utiles (Drive) et decoche **DSM**. QuickConnect n'ouvre aucun port et ne
     gene pas le tunnel de la table ;
   - **Configuration du routeur** : ne configure rien (pas de redirection de port).
   - Sur ta box, verifie que l'**UPnP** est desactive et qu'aucun port ne
     pointe vers le NAS.
4. **Securite** :
   - **Protection** > active le **blocage automatique** (5 essais en 5 min) ;
   - **Pare-feu** > active-le, profil personnalise : *Autoriser* tout depuis
     ton reseau local (ex. `192.168.1.0/255.255.255.0`), puis *Refuser* tout le
     reste. Le tunnel n'en a pas besoin : il part du NAS vers l'exterieur.
5. **Terminal & SNMP** : on activera SSH a l'etape 4, uniquement le temps de
   l'installation.

## Etape 2 — Les fichiers de jeu (Google Drive -> NAS)

1. Rassemble **tout** dans ton dossier Google Drive `JDR` (cartes, jetons,
   portraits, compendium, parties **et les icones**, aujourd'hui stockees en
   local sur ton PC) : un seul endroit, plus simple a maintenir.
2. Cree un dossier partage `jdr` sur le NAS (**Panneau de configuration >
   Dossier partage**). Donne a l'utilisateur `vtt` la **lecture/ecriture**.
3. Installe le paquet **Cloud Sync**, connecte ton Google Drive, et synchronise
   le dossier distant `JDR` vers `/jdr/JDR` du NAS, en mode
   **bidirectionnel**. Tu peux ainsi continuer a deposer tes cartes depuis le
   PC, elles arrivent sur le NAS en quelques minutes.

> Ne lance pas la table sur ton PC pendant qu'elle tourne sur le NAS : les deux
> ecriraient dans le meme dossier. Le serveur previent s'il detecte ce cas.

## Etape 3 — Le nom de domaine et le tunnel Cloudflare

1. Cree un compte gratuit sur https://dash.cloudflare.com.
2. Achete un domaine : soit directement chez Cloudflare (**Domain
   Registration**, vendu au prix coutant, mais pas de `.fr`), soit ailleurs
   (OVH, Gandi…) puis, dans Cloudflare, **Add a domain** et remplace les
   « serveurs de noms » chez ton vendeur par ceux que Cloudflare indique.
3. Dans Cloudflare, ouvre **Zero Trust** (offre gratuite) >
   **Networks > Tunnels > Create a tunnel** > type **Cloudflared** >
   nom `nas-vtt`.
4. Cloudflare affiche des commandes d'installation : **ne les execute pas**.
   Copie seulement la longue suite de caracteres qui suit `--token` : c'est le
   **jeton du tunnel**. Garde-le secret (c'est la cle de ton adresse).
5. Etape **Public hostname** :
   - Subdomain : `table` · Domain : ton domaine
   - Service : **HTTP** · URL : `localhost:3000`
6. Enregistre. Le tunnel apparaitra « Healthy » quand le NAS sera lance.

## Etape 4 — Installer la table sur le NAS

1. Cree un dossier partage `vtt` ; donne a `vtt` la lecture/ecriture.
2. Copie le projet dedans (depuis ton PC, via File Station ou le lecteur
   reseau), **sans** les dossiers `node_modules`, `client/dist` et `donnees-mj`,
   et sans ton `.env` du PC.
3. Active **SSH** (Panneau de configuration > Terminal & SNMP), puis depuis
   ton PC, ouvre PowerShell :
   ```
   ssh ton-compte-admin@192.168.1.XX
   cd /volume1/vtt
   npm install
   npm run build
   ```
   (Si `npm` est introuvable, utilise
   `/var/packages/Node.js_v22/target/usr/local/bin/npm`.)
4. Toujours en SSH, ouvre le fichier `.env` cree par l'installation
   (`vi .env`, ou modifie-le depuis ton PC via le lecteur reseau) :
   ```ini
   VTT_ASSETS=/volume1/jdr/JDR
   VTT_NOM_PARTIE=World of Warcraft
   VTT_NOM_POSTE=NAS
   VTT_MOTDEPASSE_MJ=une-longue-phrase-secrete-du-MJ
   VTT_CODE_TABLE=un-code-a-donner-aux-joueurs
   VTT_HOTE=127.0.0.1
   VTT_TUNNEL_JETON=le-jeton-copie-a-l-etape-3
   VTT_ADRESSE_PUBLIQUE=https://table.ton-domaine.com
   ```
   - `VTT_HOTE=127.0.0.1` : la table n'ecoute que le tunnel. Meme chez toi,
     tu passes par l'adresse publique.
   - `VTT_CODE_TABLE` : sans lui, quiconque a le lien entre comme joueur.
5. Rends le dossier a l'utilisateur `vtt` : `sudo chown -R vtt /volume1/vtt`.
6. **Desactive SSH** une fois fini.

## Etape 5 — Demarrage automatique

**Panneau de configuration > Planificateur de taches** :

1. **Creer > Tache declenchee > Script defini par l'utilisateur**
   - Nom : `Table JDR` · Utilisateur : `vtt` · Evenement : **Demarrage**
   - Parametres de tache : `sh /volume1/vtt/scripts/nas-demarrer.sh`
2. **Creer > Tache declenchee** (desactivee, a lancer a la main)
   - Nom : `Arreter la table JDR` · Utilisateur : `vtt`
   - Parametres : `sh /volume1/vtt/scripts/nas-arreter.sh`
3. Selectionne `Table JDR` > **Executer**. Apres une minute, ouvre
   `https://table.ton-domaine.com` : l'ecran de connexion doit s'afficher.

Le script relance la table toute seule si elle plante, et le tunnel se
reconnecte seul apres une coupure Internet. Journal : `/volume1/vtt/vtt.log`.

## Mettre a jour la table

1. Executer `Arreter la table JDR`.
2. Recopier les fichiers modifies du projet dans `/volume1/vtt`.
3. Si des dependances ou l'interface ont change : SSH, `npm install` puis
   `npm run build`.
4. Executer `Table JDR`.

## Ce qui reste a savoir

- **La carte entiere est envoyee aux joueurs** : le brouillard la cache a
  l'ecran, mais un joueur curieux peut ouvrir l'image. Limite connue du code.
- **Le debit montant de ta connexion** compte : chaque joueur telecharge les
  cartes. En fibre, aucun souci ; en ADSL, allege les images (WebP, < 3 Mo).
- Le DS218play (1 Go de memoire) suffit largement pour 7 personnes.
