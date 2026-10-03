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

export type Raccourci = { type: "objet" | "sort" | "attaque"; reference: string };
/** Une attaque de monstre (copiee du bestiaire sur sa fiche). */
export type AttaqueMonstre = { nom: string; toucher: number; degats: string; type: string };

/** Un sort du grimoire (copie de l'entree du compendium). */
export type SortConnu = {
  id: string;
  source: string | null;
  nom: string;
  niveau: number;
  ecole: string;
  icone?: string;
  incantation: string;
  portee: string;
  composantes: string;
  duree: string;
  concentration: boolean;
  rituel: boolean;
  description: string;
  degats?: { formule: string; type: string };
  soins?: string;
  cout?: { ressource: string; quantite: number };
  resolution?: "attaque" | "sauvegarde" | "automatique";
  sauvegarde?: string;
};

/** Un modele de monstre du bestiaire (compendium, section "monstres"). MJ seulement. */
export type Monstre = {
  id: string;
  nom: string;
  type: string;
  puissance: string;
  niveau: number;
  pv: number | string;
  classeArmure: number;
  vitesse: string;
  caracteristiques: Record<string, number>;
  attaques: { nom: string; toucher: number; degats: string; type: string }[];
  butin: { id: string; quantite: number }[];
  icone?: string;
  jeton?: string;
  taille: number;
  rang: Rang;
  description: string;
  modifiable?: boolean; // cree depuis le jeu (mes-monstres.json) : modifiable et supprimable ici
};

/** Le compendium du MJ (objets, sorts, auras, monstres) et ses erreurs de lecture. */
export type Compendium = {
  objets: (Objet & { id: string })[];
  sorts: SortConnu[];
  etats: { cle: string; nom: string; nature: "buff" | "debuff"; icone: string; description: string; officiel: boolean }[];
  monstres: Monstre[];
};

/** Une note du carnet PRIVE (seul son auteur la recoit). */
export type Note = { id: string; titre: string; texte: string; modifieLe: string };

export type Quete = { id: string; titre: string; objectif: string; description: string; statut: "en-cours" | "terminee" | "echouee"; creeLe: string };

/** Une ligne de la fenetre de resolution : un d20 (ou des des) et ses modificateurs. */
export type LigneJet = {
  libelle: string;
  d20: number | null;
  d20Ecarte: number | null; // avantage / desavantage : le d20 non garde
  des: { formule: string; jets: number[]; total: number; faces: number } | null;
  modificateurs: { nom: string; valeur: number }[];
  total: number;
  critique: boolean;
  echec: boolean;
};
/** Un jet lance par le serveur, en attente de "Valider" (ou valide). */
export type Jet = {
  id: string;
  idPersonnage: string | null; // null : des libres du lanceur
  personnage: string;
  par: string;
  secret?: boolean; // jet secret du MJ
  statut: "en-attente" | "valide";
  action: { genre: "arme" | "sort" | "test" | "des"; nom: string; icone: string | null; rarete: string | null; detail: string };
  lignes: LigneJet[];
  note: string | null;
  cout: string | null;
};
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
  sexe: "masculin" | "feminin" | null; // choisi a la creation (portrait par defaut race + sexe)
  rang: Rang | null; // monstres : cadre de cible normal, elite, rare, boss
  repose: boolean; // apres un repos long : portrait "repose" facon WoW (Zzz)
  attaquesMonstre: AttaqueMonstre[]; // monstres du bestiaire : leurs attaques
  jeton: string | null; // image du pion (dossier jetons/), sinon le portrait
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
  grimoire: SortConnu[];
  etats: EtatActif[];
  derives: { modificateurs: Record<string, number>; bonusDeMaitrise: number; bonusInitiative: number; attaques: Attaque[] };
};

export type Pion = {
  id: string;
  idPersonnage: string;
  cache?: boolean; // MJ : pion cache aux joueurs (ils ne le recoivent meme pas)
  taille: number; // en cases de cote (2 = un ogre)
  image: string | null; // image dessinee dans le pion (sous /medias/), sinon les initiales
  x: number;
  y: number;
  couleur: string;
  nom: string;
  proprietaire: string | null;
  // Monstres seulement : ce qu'en montre le cadre de cible (les joueurs n'ont pas sa fiche).
  niveau?: number;
  rang?: Rang;
  sante?: number; // pourcentage arrondi a 10 % (jamais les PV exacts)
};

export type Rang = "normal" | "elite" | "rare" | "boss";

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
  caracteristiqueIncantation?: Caracteristique;
  maitriseSauvegardes: Caracteristique[];
  progressionSorts: "complete" | "demi";
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

export type OutilCarte = "deplacer" | "tracer" | "ping" | "gomme" | "pinceau"; // gomme / pinceau : MJ (brouillard)

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
  // masque : un monstre que les joueurs ne voient pas ("???", ni identifiant ni jet)
  participants: { id: string; idPersonnage: string | null; nom: string; initiative: number | null; masque?: boolean }[];
} | null;

export type LigneJournal = {
  id: number;
  texte: string;
  type: "systeme" | "des" | "combat" | "butin" | "erreur" | "dire" | "groupe" | "murmure";
  // Messages de joueurs : qui parle (son pseudo, pour lui murmurer d'un clic) et sous quel nom.
  message?: { pseudo: string; nom: string; vers?: string; envoye?: boolean; heure: string; mj?: boolean };
};

/** Un message de la discussion, tel que le serveur le diffuse. */
export type MessageChat = { canal: "dire" | "groupe" | "murmure"; de: string; mj?: boolean; nom: string; texte: string; vers?: string; horodatage: string };
