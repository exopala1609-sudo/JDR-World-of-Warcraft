// Formes des donnees recues du serveur (voir server/src/modeles).
export type Role = "mj" | "joueur";
export type Profil = { role: Role; pseudo: string };
export type Table = { id: string; nom: string };

export type Ressource = {
  cle: string;
  nom: string;
  type: "jauge" | "compteur";
  actuel: number;
  max: number;
  apparence: string;
};

export type Objet = {
  id: string;
  source: string | null;
  nom: string;
  type: string;
  rarete: string;
  quantite: number;
  icone?: string;
  poids: number;
  valeur: number;
  description: string;
  arme?: { degats: string; typeDegats: string; proprietes: string[] };
  armure?: { classeArmure: number; categorie: string; dexteriteMax?: number };
  soins?: string;
  emplacement?: string;
};

export type Raccourci = { type: "objet"; reference: string };
export type Attaque = { emplacement: string; idObjet: string; nom: string; bonus: number; degats: string; typeDegats: string };

/** Un coffre ou un cadavre sur la carte. Les joueurs n'en recoivent pas le contenu. */
export type ButinCarte = { id: string; genre: "coffre" | "cadavre"; nom: string; x: number; y: number; vide?: boolean; objets?: Objet[] };
/** Un butin ouvert (fenetre de butin) : son contenu, et ou afficher la fenetre. */
export type ButinOuvert = { id: string; nom: string; genre: string; objets: Objet[]; x: number; y: number };

export type EtatActif = {
  id: string;
  cle: string;
  nom: string;
  nature: "buff" | "debuff";
  icone: string;
  description: string;
  roundsRestants: number | null;
};

export type Personnage = {
  id: string;
  proprietaire: string | null;
  nom: string;
  classe: string;
  race: string | null;
  faction: string | null;
  portrait: string | null; // fichier du dossier portraits/
  sacPrive?: boolean; // fiche d'un autre joueur : le serveur n'envoie pas le contenu de son sac
  niveau: number;
  caracteristiques: Record<string, number>;
  classeArmure: number;
  pointsDeVie: { max: number; actuels: number; temporaires: number };
  desDeVie: { faces: number; restants: number };
  ressources: Ressource[];
  inventaire: Objet[];
  equipement: Record<string, Objet>;
  barreActions: (Raccourci | null)[];
  grimoire: { id: string; nom: string; niveau: number }[];
  etats: EtatActif[];
  derives: { modificateurs: Record<string, number>; bonusDeMaitrise: number; bonusInitiative: number; attaques: Attaque[] };
};

export type Pion = {
  id: string;
  idPersonnage: string;
  x: number;
  y: number;
  couleur: string;
  nom: string;
  proprietaire: string | null;
};

// --- Referentiel : les fichiers JSON du dossier referentiel/ (races, classes...) ---------
export type Caracteristique = "force" | "dexterite" | "constitution" | "intelligence" | "sagesse" | "charisme";

export type Faction = { id: string; nom: string; description: string; embleme: string; couleur: string };

export type Race = {
  id: string;
  nom: string;
  factions: string[];
  description: string;
  icone: string;
  taille: string;
  vitesse: number;
  bonusCaracteristiques: Partial<Record<Caracteristique, number>>;
  bonusAuChoix?: { bonus: number[]; parmi: "toutes" | Caracteristique[] };
  pvParNiveau: number;
  langues: string[];
  traits: { nom: string; description: string }[];
  classesPermises: string[]; // calcule par le serveur (restrictions comprises)
};

export type Classe = {
  id: string;
  nom: string;
  equivalentDnd?: string;
  description: string;
  icone: string;
  couleur: string;
  deDeVie: number;
  caracteristiquesPrincipales: Caracteristique[];
  defenseSansArmure: Caracteristique[];
  ressources: { ressource: string }[];
};

export type ModeleRessource = { id: string; nom: string; type: "jauge" | "compteur"; max: number; couleur?: string; description: string };

export type MethodeCaracteristiques = "tableau-standard" | "achat-de-points";

export type Referentiel = {
  factions: Faction[];
  races: Race[];
  classes: Classe[];
  ressources: ModeleRessource[];
  creation: {
    methodes: MethodeCaracteristiques[];
    tableauStandard: number[];
    achatDePoints: { budget: number; couts: Record<string, number> };
    caracteristiqueMaximale: number;
    restrictionsRaceClasse: boolean;
  };
};

/** Trace tactique (ligne a main levee) : points en pixels de la carte. */
export type Trace = { id: string; auteur?: string; couleur: string; points: [number, number][] };

/** Texte de combat flottant envoye par le serveur. */
export type TexteCombat = {
  idPersonnage: string;
  genre: "degats" | "soins";
  montant: number;
  critique: boolean;
  absorbe: number;
};

export type OutilCarte = "deplacer" | "tracer" | "ping";

export type Scene = {
  carte: { fichier: string | null; largeur: number; hauteur: number };
  grille: { taille: number; decalageX: number; decalageY: number; visible: boolean };
  pions: Pion[];
  butins: ButinCarte[];
  brouillard: { actif: boolean; traits: unknown[] };
};

export type Combat = {
  round: number;
  indexActif: number;
  participants: { id: string; idPersonnage: string; nom: string; initiative: number }[];
} | null;

export type LigneJournal = { id: number; texte: string; type: "systeme" | "des" | "combat" | "butin" | "erreur" };
