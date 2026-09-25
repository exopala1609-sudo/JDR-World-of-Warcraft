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
  armure?: { classeArmure: number; categorie: string };
  soins?: string;
};

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
  niveau: number;
  caracteristiques: Record<string, number>;
  classeArmure: number;
  pointsDeVie: { max: number; actuels: number; temporaires: number };
  desDeVie: { faces: number; restants: number };
  ressources: Ressource[];
  inventaire: Objet[];
  grimoire: { id: string; nom: string; niveau: number }[];
  etats: EtatActif[];
  derives: { modificateurs: Record<string, number>; bonusDeMaitrise: number; bonusInitiative: number };
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
  brouillard: { actif: boolean; traits: unknown[] };
};

export type Combat = {
  round: number;
  indexActif: number;
  participants: { id: string; idPersonnage: string; nom: string; initiative: number }[];
} | null;

export type LigneJournal = { id: number; texte: string; type: "systeme" | "des" | "combat" | "butin" | "erreur" };
