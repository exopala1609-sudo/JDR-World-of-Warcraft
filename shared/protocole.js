// Vocabulaire commun entre le serveur (PC du MJ) et les navigateurs.
// Chaque message qui circule dans le "tuyau" temps reel porte un de ces noms.
// Un seul fichier de reference : le serveur et les clients ne peuvent pas
// se desynchroniser sur l'orthographe d'un evenement.

export const VERSION_PROTOCOLE = 3;

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
  PERSONNAGE_CREER: "personnage:creer",
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

  // Compendium, inventaire, grimoire
  COMPENDIUM_LISTER: "compendium:lister", // MJ
  COMPENDIUM_RECHARGER: "compendium:recharger", // MJ
  INVENTAIRE_AJOUTER: "inventaire:ajouter", // MJ : depuis le compendium
  INVENTAIRE_RETIRER: "inventaire:retirer",
  GRIMOIRE_APPRENDRE: "grimoire:apprendre", // MJ : depuis le compendium
  GRIMOIRE_OUBLIER: "grimoire:oublier",

  // Combat
  COMBAT_DEMARRER: "combat:demarrer", // MJ : lance l'initiative
  COMBAT_TOUR_SUIVANT: "combat:tourSuivant", // MJ, ou le joueur dont c'est le tour
  COMBAT_TOUR_PRECEDENT: "combat:tourPrecedent", // MJ
  COMBAT_AJOUTER: "combat:ajouter", // MJ
  COMBAT_RETIRER: "combat:retirer", // MJ
  COMBAT_FIXER_INITIATIVE: "combat:fixerInitiative", // MJ
  COMBAT_TERMINER: "combat:terminer", // MJ

  // Des et medias
  DES_LANCER: "des:lancer",
  MEDIAS_LISTER: "medias:lister", // MJ

  // ======= Serveur -> Clients : des FAITS (deja valides par le serveur) =====
  TABLES_LISTE: "tables:liste",
  TABLE_PRESENCE: "table:presence",
  PERSONNAGE_MAJ: "personnage:maj", // une fiche a change (avec sa "cause")
  PERSONNAGE_SUPPRIME: "personnage:supprime",
  COMBAT_ETAT: "combat:etat", // photo complete du combat (ou null a la fin)
  COMPENDIUM_MAJ: "compendium:maj", // MJ : le compendium a ete recharge
  DES_RESULTAT: "des:resultat",
});

// Types de modification des points de vie (regles D&D 5e).
export const TYPES_PV = /** @type {const} */ ({
  DEGATS: "degats",
  SOINS: "soins",
  TEMPORAIRES: "temporaires",
});
