// Vocabulaire commun entre le serveur (PC du MJ) et les navigateurs.
// Chaque message qui circule dans le "tuyau" temps reel porte un de ces noms.
// Un seul fichier de reference : le serveur et les clients ne peuvent pas
// se desynchroniser sur l'orthographe d'un evenement.

export const VERSION_PROTOCOLE = 11;

export const ROLES = /** @type {const} */ ({
  MJ: "mj",
  JOUEUR: "joueur",
});

export const EVENEMENTS = /** @type {const} */ ({
  // ======= Client -> Serveur : des DEMANDES (le serveur peut refuser) =======

  // Tables
  TABLES_LISTER: "tables:lister",
  TABLE_CREER: "table:creer", // MJ
  TABLE_REJOINDRE: "table:rejoindre",

  // Personnages
  CREATION_VALIDER: "creation:valider", // joueur : "Entrer dans le monde" (ecran de creation)
  PERSONNAGE_CREER: "personnage:creer", // MJ : creation libre (PNJ, monstres)
  PERSONNAGE_SUPPRIMER: "personnage:supprimer",
  PERSONNAGE_MODIFIER_PV: "personnage:modifierPv",

  // Ressources (Mana, Rage, Eclats d'ame...)
  RESSOURCE_MODIFIER: "ressource:modifier", // depenser / gagner
  RESSOURCE_AJOUTER: "ressource:ajouter", // MJ : ajoute une jauge d'apres un modele
  RESSOURCE_RETIRER: "ressource:retirer", // MJ

  // Repos
  REPOS_COURT: "repos:court",
  REPOS_LONG: "repos:long", // MJ (un personnage ou toute la table)

  // Etats (auras / debuffs)
  ETAT_POSER: "etat:poser",
  ETAT_RETIRER: "etat:retirer",

  // Referentiel : factions, races, classes (regles de creation, publiques)
  REFERENTIEL_LISTER: "referentiel:lister",
  REFERENTIEL_RECHARGER: "referentiel:recharger", // MJ
  PORTRAITS_LISTER: "portraits:lister", // les images du dossier portraits/ (ecran de creation)

  // Compendium, inventaire, grimoire
  COMPENDIUM_LISTER: "compendium:lister", // MJ
  COMPENDIUM_RECHARGER: "compendium:recharger", // MJ
  INVENTAIRE_AJOUTER: "inventaire:ajouter", // MJ : depuis le compendium
  INVENTAIRE_RETIRER: "inventaire:retirer",
  GRIMOIRE_APPRENDRE: "grimoire:apprendre", // MJ : depuis le compendium
  GRIMOIRE_OUBLIER: "grimoire:oublier",

  // Equipement et barre d'actions (le proprietaire ou le MJ)
  EQUIPER: "equipement:equiper", // du sac vers un emplacement de la fiche
  DESEQUIPER: "equipement:desequiper", // de la fiche vers le sac
  BARRE_DEFINIR: "barre:definir", // poser / retirer un raccourci
  OBJET_UTILISER: "objet:utiliser", // boire une potion, attaquer avec une arme
  SORT_LANCER: "sort:lancer", // lancer un sort du grimoire (fenetre de resolution)
  TEST_LANCER: "test:lancer", // test de caracteristique / sauvegarde (lanceur de des)
  JET_VALIDER: "jet:valider", // "Valider" dans la fenetre de resolution

  // Journal de quetes (MJ)
  QUETE_AJOUTER: "quete:ajouter",
  QUETE_MODIFIER: "quete:modifier", // terminee, echouee, en cours
  QUETE_SUPPRIMER: "quete:supprimer",

  // Butin : coffres et cadavres
  BUTIN_OUVRIR: "butin:ouvrir", // voir le contenu (il faut etre a cote)
  BUTIN_FERMER: "butin:fermer",
  BUTIN_PRENDRE: "butin:prendre", // un objet du butin vers son sac
  BUTIN_CREER: "butin:creer", // MJ : poser un coffre
  BUTIN_AJOUTER: "butin:ajouter", // MJ : y mettre un objet du compendium
  BUTIN_SUPPRIMER: "butin:supprimer", // MJ
  PION_EN_CADAVRE: "pion:enCadavre", // MJ : le monstre tombe, son cadavre se fouille

  // Combat
  COMBAT_DEMARRER: "combat:demarrer", // MJ : lance l'initiative
  COMBAT_TOUR_SUIVANT: "combat:tourSuivant", // MJ, ou le joueur dont c'est le tour
  COMBAT_TOUR_PRECEDENT: "combat:tourPrecedent", // MJ
  COMBAT_AJOUTER: "combat:ajouter", // MJ
  COMBAT_RETIRER: "combat:retirer", // MJ
  COMBAT_FIXER_INITIATIVE: "combat:fixerInitiative", // MJ
  COMBAT_TERMINER: "combat:terminer", // MJ

  // Scene : carte, grille, pions, brouillard
  SCENE_CARTE: "scene:carte", // MJ : choisir l'image de la carte
  SCENE_GRILLE: "scene:grille", // MJ : taille et decalage de la grille
  PION_PLACER: "pion:placer", // MJ : poser le pion d'un personnage
  PIONS_PLACER_TOUS: "pions:placerTous", // MJ
  PION_RETIRER: "pion:retirer", // MJ
  PION_CACHER: "pion:cacher", // MJ : cacher / montrer un pion aux joueurs
  PION_SAISIR: "pion:saisir", // debut d'un glisser : "je prends ce pion"
  PION_DEPLACER: "pion:deplacer", // pendant (final: false) et a la fin (final: true)
  BROUILLARD_TRAIT: "brouillard:trait", // MJ : un morceau de trait de gomme / pinceau
  BROUILLARD_TOUT: "brouillard:tout", // MJ : tout reveler / tout cacher
  BROUILLARD_ACTIF: "brouillard:actif", // MJ : activer / desactiver le brouillard

  // Dessin tactique : tout le monde (joueurs et MJ)
  CARTE_PING: "carte:ping", // "regardez ici !" : un cercle qui s'agrandit
  DESSIN_TRAIT: "dessin:trait", // un morceau de trace (envoye pendant qu'on dessine)
  DESSIN_EFFACER: "dessin:effacer", // ses propres traces (le MJ : toutes)

  // Discussion : dire, groupe, murmure (/w)
  CHAT_ENVOYER: "chat:envoyer",

  // Sons : le MJ fait jouer un son a toute la table (tambours, cri...)
  SON_DIFFUSER: "son:diffuser", // MJ

  // Joueurs (MJ)
  JOUEUR_EXPULSER: "joueur:expulser", // deconnecte un joueur et lui ferme la table
  JOUEUR_READMETTRE: "joueur:readmettre", // lui rouvre la table

  // Des et medias
  DES_LANCER: "des:lancer",
  MEDIAS_LISTER: "medias:lister", // MJ

  // ======= Serveur -> Clients : des FAITS (deja valides par le serveur) =====
  TABLES_LISTE: "tables:liste",
  TABLE_PRESENCE: "table:presence",
  PERSONNAGE_MAJ: "personnage:maj", // une fiche a change (avec sa "cause")
  PERSONNAGE_SUPPRIME: "personnage:supprime",
  COMBAT_ETAT: "combat:etat", // photo complete du combat (ou null a la fin)
  REFERENTIEL_MAJ: "referentiel:maj", // tous : le referentiel a ete recharge
  COMPENDIUM_MAJ: "compendium:maj", // MJ : le compendium a ete recharge
  DES_RESULTAT: "des:resultat",
  SCENE_ETAT: "scene:etat", // photo complete de la scene (filtree pour les joueurs)
  SCENE_GRILLE_MAJ: "scene:grilleMaj",
  PION_POSITION: "pion:position", // un pion bouge (en cours ou final)
  BROUILLARD_TRAIT_AJOUTE: "brouillard:traitAjoute",
  CARTE_PING_RECU: "carte:pingRecu",
  DESSIN_AJOUTE: "dessin:ajoute", // un morceau de trace d'un autre participant
  DESSINS_ETAT: "dessins:etat", // la liste complete des traces (apres un effacement)
  COMBAT_TEXTE: "combat:texte", // texte de combat flottant : degats, soins
  BUTIN_MAJ: "butin:maj", // le contenu d'un butin ouvert a change (quelqu'un s'est servi)
  JET_EN_COURS: "jet:enCours", // MJ : un joueur vient de lancer (fenetre de resolution)
  JET_RESULTAT: "jet:resultat", // toute la table : le jet valide
  QUETES_ETAT: "quetes:etat", // le journal de quetes complet (apres un changement)
  CHAT_MESSAGE: "chat:message", // un message de discussion (un murmure : aux 2 seuls concernes)
  SON_JOUER: "son:jouer", // "joue ce son" (murmure recu, quete terminee, combat...)
  JOUEUR_EXPULSE: "joueur:expulse", // au joueur expulse, juste avant la deconnexion
});

// Types de modification des points de vie (regles D&D 5e).
export const TYPES_PV = /** @type {const} */ ({
  DEGATS: "degats",
  SOINS: "soins",
  TEMPORAIRES: "temporaires",
});
