# Installer la table sur le NAS Synology (DS218play)

Ce guide installe la table sur ton NAS, **jouable sur ton reseau local** (chez
toi). L'acces a distance avec ton nom de domaine fera l'objet d'un second guide,
une fois cette etape validee.

Duree : environ 1 h 30 la premiere fois. Garde ce guide ouvert sur ton PC et
avance etape par etape. **Ne saute pas l'etape 1.**

Ce que tu vas obtenir :

```
NAS
├── dossier partage « vtt »   le programme (mis a jour depuis GitHub en un clic)
│   └── table/
└── dossier partage « jdr »   TES donnees : parties, cartes, portraits, icones...
```

Les deux sont separes expres : une mise a jour du programme ne peut jamais
toucher a tes parties.

Mots a connaitre :

- **DSM** : l'interface du NAS, celle que tu ouvres dans ton navigateur.
- **SSH** : une fenetre de commandes a distance sur le NAS. On s'en sert une
  seule fois, pour l'installation, puis on la referme.
- **Tache planifiee** : un programme que DSM lance tout seul (au demarrage du
  NAS) ou quand tu cliques sur « Executer ».

---

## Etape 1 — Proteger le NAS (15 min)

Dans DSM, **Panneau de configuration** :

1. **Mise a jour et restauration** : installe les mises a jour disponibles.
   Regle les mises a jour automatiques sur « Installer automatiquement les
   correctifs importants ».
2. **Utilisateur et groupe** :
   - si le compte `admin` existe encore et n'est pas desactive, desactive-le
     (garde ton propre compte administrateur) ;
   - onglet **Avance** : active la **verification en 2 etapes** au moins pour
     les administrateurs (application d'authentification sur ton telephone).
3. **Securite > Protection** : active le **blocage automatique**
   (par exemple 5 essais en 5 minutes).
4. **Securite > Pare-feu** : active le pare-feu, puis **Modifier les regles** :
   - regle 1 : *Autoriser*, tous les ports, source = ton reseau local
     (par exemple `192.168.1.0`, masque `255.255.255.0` : regarde l'adresse de
     ton NAS, les trois premiers nombres sont ceux de ton reseau) ;
   - regle 2 (en dessous) : *Refuser*, tous les ports, toutes les sources.

   Le tunnel du second guide n'aura besoin d'aucune autre regle : c'est le NAS
   qui appellera l'exterieur, jamais l'inverse.
5. **Acces externe > QuickConnect** : si tu ne t'en sers pas, desactive-le.
   Si tu t'en sers (Synology Drive, Photos a distance), garde-le mais
   **Parametres avances > Autorisations** : decoche **DSM**.
6. **Acces externe > Configuration du routeur** : n'y configure rien.
   Sur ta box, verifie qu'aucune « redirection de port » ne vise le NAS et que
   l'**UPnP** est desactive.

## Etape 2 — Les paquets (5 min)

**Centre de paquets** :

- **Node.js v22** : deja installe chez toi. Rien a faire.
- **Git Server** : clique sur **Installer**. C'est lui qui permet au NAS de
  telecharger les mises a jour depuis GitHub.
- **Hyper Backup** : installe-le aussi (copie de secours, etape 9).

## Etape 3 — L'utilisateur et les dossiers (10 min)

1. **Panneau de configuration > Utilisateur et groupe > Creer** :
   - nom : `vtt`, un mot de passe long (tu n'en auras pas besoin au quotidien :
     note-le dans ton gestionnaire de mots de passe) ;
   - groupe : `users` seulement (**pas** `administrators`) ;
   - applications : refuse tout (DSM, File Station, SMB...).

   C'est ce compte qui fera tourner la table. Si un jour la table etait
   piratee, l'intrus n'aurait que les droits de `vtt` : ni DSM, ni tes autres
   dossiers.
2. **Panneau de configuration > Dossier partage > Creer**, deux fois :
   - `vtt` : droits **Lecture/ecriture** pour `vtt` et pour ton compte ;
   - `jdr` : droits **Lecture/ecriture** pour `vtt` et pour ton compte.
3. Ouvre **File Station**, clic droit sur `jdr` > **Proprietes** : note
   l'**emplacement**, normalement `/volume1/jdr`. Si c'est un autre numero
   (`/volume2/...`), dis-le-moi avant l'etape 5.

## Etape 4 — Copier tes donnees sur le NAS (10 a 30 min)

1. Sur ton PC, **arrete la table** si elle tourne (Ctrl + C).
2. Ouvre le fichier `.env` du projet sur ton PC et note :
   - la ligne `VTT_ASSETS=` (ton dossier `JDR` dans Google Drive) ;
   - les lignes `VTT_ASSETS_...=` qui ne commencent pas par `#` : ce sont
     des dossiers ranges ailleurs (souvent les icones).
3. Dans l'Explorateur Windows, tape dans la barre d'adresse
   `\\ADRESSE-DU-NAS\jdr` (par exemple `\\192.168.1.20\jdr`) et connecte-toi
   avec ton compte.
4. Copie **le contenu** de ton dossier `JDR` (les dossiers `cartes`,
   `parties`, `portraits`, `compendium`...) dans `jdr`. Puis, pour chaque
   dossier range ailleurs, copie son contenu dans le sous-dossier du meme nom
   (par exemple tes icones dans `jdr\icones`).
5. Pour ne plus te tromper de dossier : renomme ton dossier Google Drive
   `JDR` en `JDR-ancien`. A partir d'aujourd'hui, **le NAS est la reference**.
   (Tes mots de passe joueurs, dans `parties`, suivent automatiquement.)

## Etape 5 — Installer la table (15 min, en SSH)

1. **Panneau de configuration > Terminal et SNMP** : coche **Activer le
   service SSH**, puis **Appliquer**.
2. Sur ton PC, ouvre **PowerShell** (touche Windows, tape `powershell`) et
   connecte-toi (remplace par ton compte et l'adresse du NAS) :

   ```
   ssh ton-compte@192.168.1.20
   ```

   Accepte l'empreinte (`yes`) la premiere fois, puis tape ton mot de passe
   (il ne s'affiche pas, c'est normal). Si tu as active la verification en 2
   etapes, le code te sera aussi demande.
3. Copie-colle ces commandes, **une par une** (clic droit pour coller dans
   PowerShell). `sudo` redemande ton mot de passe la premiere fois.

   Trouver ou Git Server a range la commande `git` (elle n'est pas toujours
   connue de `sudo`) ; la reponse ressemble a `/var/packages/Git/target/bin/git` :

   ```
   find /var/packages -maxdepth 5 -type f -name git 2>/dev/null
   ```

   Telecharger la table depuis GitHub, en remplacant le debut par le chemin
   affiche juste au-dessus :

   ```
   sudo /var/packages/Git/target/bin/git clone -b deploiement https://github.com/exopala1609-sudo/JDR-World-of-Warcraft.git /volume1/vtt/table
   ```

   La confier a l'utilisateur `vtt` :

   ```
   sudo chown -R vtt:users /volume1/vtt/table
   ```

   Lancer l'installation (en tant que `vtt`) :

   ```
   sudo -u vtt sh /volume1/vtt/table/scripts/nas-installer.sh
   ```

   L'installation verifie Node.js et git, installe ce qu'il faut (une a deux
   minutes), puis **te demande le mot de passe du MJ** : choisis une petite
   phrase (10 caracteres minimum), tape-la deux fois. Elle ne s'affiche pas.
4. Si une ligne commence par `!!`, arrete-toi et envoie-moi ce qui est ecrit.
5. Tape `exit` pour fermer la connexion, puis dans DSM **decoche** le service
   SSH (**Terminal et SNMP**). Tu n'en auras plus besoin.

## Etape 6 — Demarrage automatique et mises a jour (10 min)

**Panneau de configuration > Planificateur de taches > Creer > Tache
declenchee > Script defini par l'utilisateur**, trois fois :

| Nom | Utilisateur | Evenement | Script (onglet « Parametres de tache ») | Activee |
|---|---|---|---|---|
| `Table JDR` | `vtt` | Demarrage | `sh /volume1/vtt/table/scripts/nas-demarrer.sh` | oui |
| `Mettre a jour la table` | `vtt` | Demarrage | `sh /volume1/vtt/table/scripts/nas-mettre-a-jour.sh` | **non** |
| `Arreter la table` | `vtt` | Demarrage | `sh /volume1/vtt/table/scripts/nas-arreter.sh` | **non** |

Les deux dernieres sont **desactivees** : elles ne se lancent jamais seules, tu
les lances toi-meme avec **Executer**.

Puis selectionne `Table JDR` et clique sur **Executer**.

## Etape 7 — Premier essai sur ton reseau (5 min)

1. Attends une minute, puis ouvre sur ton PC : `http://ADRESSE-DU-NAS:3000`
   (par exemple `http://192.168.1.20:3000`).
2. L'ecran de connexion doit s'afficher. Connecte-toi en MJ avec le mot de
   passe choisi a l'etape 5 : tes tables et personnages doivent etre la.
3. Fais entrer un joueur (une autre fenetre de navigateur suffit) : carte,
   portraits, icones, sons doivent s'afficher.
4. **Redemarre le NAS** (menu en haut a droite de DSM > Redemarrer), attends
   qu'il soit revenu, puis recharge la page : la table doit repondre toute
   seule, sans que tu lances quoi que ce soit.
5. Ouvre le **Moniteur de ressources > Performances > Memoire** et note le
   pourcentage utilise, table lancee.

Si la page ne s'affiche pas : dans File Station, ouvre `vtt/table/vtt.log`
(les messages de la table) et `vtt/table/vtt-nas.log` (demarrages, arrets et
mises a jour), et envoie-moi les dernieres lignes.

## Etape 8 — Mettre a jour la table

Quand je publie une nouvelle version, GitHub prepare automatiquement une copie
« prete pour le NAS » (interface deja compilee). Pour l'installer :

**Planificateur de taches** > `Mettre a jour la table` > **Executer**.

- Ca prend moins d'une minute ; les joueurs connectes voient « reconnexion »
  quelques secondes, puis reviennent en jeu.
- Si la nouvelle version ne demarre pas, **l'ancienne est remise toute
  seule** (ca prend alors une minute et demie).
- Le resultat est ecrit dans `vtt/table/vtt-nas.log`.

Conseil : fais-le en dehors des parties.

## Etape 9 — Copie de secours vers Google Drive (10 min)

La table prend deja des copies de secours (`jdr/sauvegardes`, voir
`docs/SAUVEGARDES.md`), mais elles sont sur le meme disque. Pour survivre a
une panne du NAS :

1. Ouvre **Hyper Backup** > **+** > **Tache de sauvegarde des donnees**.
2. Destination : **Google Drive** ; connecte ton compte Google ; choisis un
   dossier (par exemple `Sauvegardes NAS`).
3. Dossier a sauvegarder : coche **`jdr`** (inutile de sauvegarder `vtt` :
   GitHub en a la copie).
4. Planification : tous les jours, par exemple a 4 h du matin.
5. **Rotation des sauvegardes** : active-la, garde par exemple 30 versions.
6. Termine, puis lance une premiere sauvegarde (**Sauvegarder maintenant**).

A savoir : Hyper Backup range les fichiers dans son propre format (pas
directement lisibles dans Google Drive). Pour recuperer quelque chose, on
passe par Hyper Backup > **Restaurer**. En echange, tu as les 30 derniers
jours, et pas seulement le dernier etat.

---

## Ce que je n'ai pas pu verifier moi-meme (a me confirmer)

- Que **Git Server** rend bien la commande `git` disponible (l'installation
  le verifie et te le dira).
- Qu'une tache **au demarrage** peut tourner en permanence (c'est l'usage
  courant sur Synology ; l'etape 7.4 le verifie).
- La memoire reellement utilisee sur ton NAS (etape 7.5).

## Et ensuite ?

Quand l'etape 7 fonctionne, envoie-moi :
- les messages de l'installation (etape 5) ;
- le pourcentage de memoire (etape 7.5).

Puis on passera a l'**acces a distance** avec ton nom de domaine.
