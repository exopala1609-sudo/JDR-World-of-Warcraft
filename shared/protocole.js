// Vocabulaire commun entre le serveur (PC du MJ) et les navigateurs des joueurs.
// Un seul endroit pour les noms d'evenements : impossible de se desynchroniser.

export const ROLES = /** @type {const} */ ({
  MJ: "mj",
  JOUEUR: "joueur",
});

export const EVENEMENTS = /** @type {const} */ ({
  // Client -> Serveur
  REJOINDRE: "session:rejoindre",

  // Serveur -> Client
  BIENVENUE: "session:bienvenue",
  ETAT_SESSION: "session:etat",
  ERREUR: "session:erreur",
});

export const VERSION_PROTOCOLE = 1;
