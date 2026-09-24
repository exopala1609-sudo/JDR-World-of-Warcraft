// Vocabulaire commun entre le serveur (PC du MJ) et les navigateurs.
// Chaque message qui circule dans le "tuyau" temps reel porte un de ces noms.
// Un seul fichier de reference : le serveur et les clients ne peuvent pas
// se desynchroniser sur l'orthographe d'un evenement.

export const VERSION_PROTOCOLE = 2;

export const ROLES = /** @type {const} */ ({
  MJ: "mj",
  JOUEUR: "joueur",
});

export const EVENEMENTS = /** @type {const} */ ({
  // --- Client -> Serveur (des DEMANDES : le serveur peut refuser) ---------
  TABLES_LISTER: "tables:lister",
  TABLE_CREER: "table:creer", // MJ uniquement
  TABLE_REJOINDRE: "table:rejoindre",
  PERSONNAGE_CREER: "personnage:creer",
  PERSONNAGE_SUPPRIMER: "personnage:supprimer",
  PERSONNAGE_MODIFIER_PV: "personnage:modifierPv",
  DES_LANCER: "des:lancer",

  // --- Serveur -> Clients (des FAITS : deja valides par le serveur) -------
  TABLES_LISTE: "tables:liste", // la liste des tables a change
  TABLE_ETAT: "table:etat", // photo complete de la table (a l'arrivee)
  TABLE_PRESENCE: "table:presence", // qui est connecte a la table
  PERSONNAGE_MAJ: "personnage:maj", // un personnage a change
  PERSONNAGE_SUPPRIME: "personnage:supprime",
  DES_RESULTAT: "des:resultat", // un lancer de des a eu lieu
});

// Types de modification des points de vie (regles D&D 5e).
export const TYPES_PV = /** @type {const} */ ({
  DEGATS: "degats",
  SOINS: "soins",
  TEMPORAIRES: "temporaires",
});
