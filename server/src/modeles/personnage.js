// Modele d'un personnage de D&D 5e.
//
// Trois schemas, trois usages :
//  - SchemaPersonnage          : la fiche COMPLETE, telle qu'elle est stockee ;
//  - SchemaCreationGuidee      : ce qu'un JOUEUR envoie depuis l'ecran de
//                                creation (des CHOIX : race, classe, repartition) ;
//  - SchemaCreationPersonnage  : la saisie libre du MJ (PNJ, monstres).
// Le serveur calcule lui-meme le reste (bonus de race, PV max, CA,
// ressources) d'apres le REFERENTIEL : un joueur ne peut pas s'attribuer
// 999 PV ou une Force de 30 en trafiquant sa requete.
import {
  apercuPersonnage,
  classeArmureSansArmure,
  pvMax,
  raceDisponible,
  ressourcesDeDepart,
  restrictionDeLore,
  verifierBase,
  verifierChoixBonus,
  verifierOptions,
  verifierRepartitionHistorique,
  languesProposees,
  renommeesDeDepart,
  verifierLangues,
} from "../../../shared/creation.js";
import { CARACTERISTIQUES, bonusDeMaitrise, modificateur } from "../../../shared/dnd5e.js";
import { attaquesEquipees, IDS_EMPLACEMENTS, TAILLE_BARRE } from "../../../shared/equipement.js";
import { NATURES_ETAT } from "../../../shared/etats.js";
import { MODES_REPOS, TYPES_RESSOURCE } from "../../../shared/ressources.js";
import { champsObjet, champsSort, schemaIdCompendium } from "./compendium.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { nouvelId, schemaId } from "./identifiants.js";
import { METHODES_CARACTERISTIQUES, schemaIdReferentiel, TAILLES } from "./referentiel.js";
import { z } from "./zod.js";

// Version du format des fiches. Si elle change, modeles/migrations.js sait
// convertir les anciennes fiches : aucune sauvegarde n'est jamais perdue.
export const VERSION_FICHE = 8;
export const SEXES = /** @type {const} */ (["masculin", "feminin"]);
export const RANGS = /** @type {const} */ (["normal", "elite", "rare", "boss"]);

const entier = (min, max) => z.int().min(min).max(max);

// --- Briques ---------------------------------------------------------------

// Un portrait = un nom de fichier du dossier portraits/ (ex. "orc-1.png").
export const schemaPortrait = z
  .string()
  .regex(/^[^/\\:*?"<>|]{1,120}\.(png|jpe?g|webp|gif|svg)$/i, "Nom de fichier de portrait invalide.");

export const SchemaCaracteristiques = z.strictObject(
  Object.fromEntries(CARACTERISTIQUES.map((nom) => [nom, entier(1, 30)])),
);

export const SchemaPointsDeVie = z
  .strictObject({
    max: entier(1, 999),
    actuels: entier(0, 999),
    temporaires: entier(0, 999),
  })
  .refine((pv) => pv.actuels <= pv.max, "Les PV actuels ne peuvent pas depasser le maximum.");

// Ce qui arrive a une ressource lors d'un repos (voir shared/ressources.js).
const schemaRegleRepos = z.union([z.enum(MODES_REPOS), z.strictObject({ ajouter: entier(1, 999) })]);

export const SchemaRessource = z
  .strictObject({
    cle: z.string().regex(/^[a-z0-9-]{1,40}$/),
    nom: z.string().trim().min(1).max(60),
    type: z.enum(TYPES_RESSOURCE),
    actuel: entier(0, 999),
    max: entier(0, 999),
    reposCourt: schemaRegleRepos,
    reposLong: schemaRegleRepos,
    apparence: z.string().regex(/^[a-z0-9-]{1,40}$/),
  })
  .refine((r) => r.actuel <= r.max, "Une ressource ne peut pas depasser son maximum.");

// Un objet dans un sac : une COPIE de l'entree du compendium, avec sa quantite.
export const SchemaObjetInventaire = z.strictObject({
  id: schemaId("o"),
  source: schemaIdCompendium.nullable(), // l'entree du compendium d'origine
  quantite: entier(1, 9999),
  ...champsObjet,
});

// L'equipement porte : un objet (une COPIE, comme dans le sac) par emplacement.
export const SchemaEquipement = z.partialRecord(z.enum(IDS_EMPLACEMENTS), SchemaObjetInventaire).default({});

// Barre d'actions : 12 cases, vides (null) ou un raccourci vers un objet.
export const SchemaRaccourci = z.strictObject({
  type: z.enum(["objet", "sort", "attaque"]), // "attaque" : une attaque de monstre (son nom)
  reference: z.string().min(1).max(80), // l'origine dans le compendium, ou l'identifiant de l'objet / du sort
});
export const SchemaBarreActions = z.array(SchemaRaccourci.nullable()).length(TAILLE_BARRE);
export const barreVide = () => Array(TAILLE_BARRE).fill(null);

// Attaque d'un monstre (copiee du bestiaire a l'invocation) : jouable depuis
// le menu du MJ ou la barre d'actions du monstre.
export const SchemaAttaqueMonstre = z.strictObject({
  nom: z.string().trim().min(1).max(60),
  toucher: entier(-5, 30),
  degats: z.string().min(1).max(40),
  type: z.string().trim().max(30).default(""),
});

// Un sort connu (le "grimoire"), copie depuis le compendium.
export const SchemaSortConnu = z.strictObject({
  id: schemaId("s"),
  source: schemaIdCompendium.nullable(),
  ...champsSort,
});

// Un etat pose sur le personnage (aura, debuff).
export const SchemaEtatActif = z.strictObject({
  id: schemaId("e"),
  cle: z.string().regex(/^[a-z0-9-]{1,60}$/), // quel etat (ex. "empoisonne")
  nom: z.string().trim().min(1).max(60),
  nature: z.enum(NATURES_ETAT),
  icone: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), // identifiant visuel
  description: z.string().max(1000),
  roundsRestants: entier(1, 100).nullable(), // null = jusqu'a ce qu'on le retire
  posePar: z.string().max(40),
});

// L'origine d'un heros cree a l'ecran de creation (regles du livre WoW / D&D
// 2024). null pour un monstre, une fiche creee par le MJ, ou une fiche ancienne.
export const SchemaOrigine = z.strictObject({
  historique: schemaIdReferentiel.nullable(),
  optionsRace: z.record(schemaIdReferentiel, schemaIdReferentiel), // { lignee: "elfe-de-sang" }
  specialisation: schemaIdReferentiel.nullable(),
  sousClasse: z.string().max(80).nullable(), // imposee des la creation (Chevalier de la mort...)
  dons: z.array(schemaIdReferentiel).max(10),
  taille: z.enum(TAILLES),
  typeCreature: z.string().max(60),
  apparence: schemaIdReferentiel, // images a utiliser (portraits, icones)
  // Renommee de depart du peuple (pour memoire ; la renommee en jeu est dans "renommees").
  renommee: z.strictObject({ faction: z.string().max(60), valeur: entier(-50, 100) }).nullable(),
});

// Renommee aupres d'une faction (Forgefer, Kirin Tor...) : le MJ la fait evoluer en jeu.
export const SchemaRenommeePersonnage = z.strictObject({ faction: schemaIdReferentiel, score: entier(-100, 1000) });

// --- La fiche complete -------------------------------------------------------

export const SchemaPersonnage = z
  .strictObject({
    versionSchema: z.literal(VERSION_FICHE),
    id: schemaId("p"),
    idTable: schemaId("t"),
    // Pseudo du joueur a qui appartient la fiche, ou null pour un PNJ du MJ.
    proprietaire: z.string().nullable(),
    nom: z.string().trim().min(1).max(60),
    // Identifiants du referentiel. La race et la faction sont null pour un
    // monstre du MJ (ou une fiche creee avant l'ecran de creation).
    classe: schemaIdReferentiel,
    race: schemaIdReferentiel.nullable(),
    faction: schemaIdReferentiel.nullable(),
    portrait: schemaPortrait.nullable(),
    // Choisi a la creation : donne le portrait par defaut (race + sexe) quand
    // aucune image n'est choisie. null pour un monstre ou une fiche ancienne.
    sexe: z.enum(SEXES).nullable().default(null),
    // Monstres : leur rang (cadre de cible normal, elite, rare, boss). null pour un heros.
    rang: z.enum(RANGS).nullable().default(null),
    niveau: entier(1, 20),
    caracteristiques: SchemaCaracteristiques,
    classeArmure: entier(1, 40),
    pointsDeVie: SchemaPointsDeVie,
    desDeVie: z.strictObject({ faces: z.literal([6, 8, 10, 12]), restants: entier(0, 20) }),
    ressources: z.array(SchemaRessource).max(30),
    inventaire: z.array(SchemaObjetInventaire).max(500),
    equipement: SchemaEquipement,
    barreActions: SchemaBarreActions,
    grimoire: z.array(SchemaSortConnu).max(300),
    etats: z.array(SchemaEtatActif).max(40),
    // "Repose" facon WoW : vrai apres un repos long, jusqu'a la prochaine action
    // epuisante (degats subis, ressource depensee, sort lance, combat).
    repose: z.boolean(),
    // Monstres : leurs attaques ; tous : l'image du pion (dossier jetons/, sans extension).
    attaquesMonstre: z.array(SchemaAttaqueMonstre).max(10),
    // "gnoll" = jetons/gnoll.png ; "icones/inv_misc_head_gnoll_01" = une icone choisie au selecteur.
    jeton: z.string().regex(/^(icones\/)?[A-Za-z0-9_-]{1,80}$/).nullable(),
    origine: SchemaOrigine.nullable(),
    // Langues connues et renommee (etape 3) : choisies a la creation, puis le MJ les change.
    langues: z.array(schemaIdReferentiel).max(30),
    renommees: z
      .array(SchemaRenommeePersonnage)
      .max(60)
      .refine((r) => new Set(r.map((x) => x.faction)).size === r.length, "Une faction de renommee apparait deux fois."),
    creeLe: z.iso.datetime(),
    modifieLe: z.iso.datetime(),
  })
  .refine((p) => p.desDeVie.restants <= p.niveau, "Plus de des de vie restants que de niveaux.")
  .refine(
    (p) => new Set(p.ressources.map((r) => r.cle)).size === p.ressources.length,
    "Deux ressources portent la meme cle.",
  );

// --- Creation par un JOUEUR (ecran de creation) -------------------------------------
// Le joueur envoie des CHOIX, jamais des resultats : ses caracteristiques de
// BASE (avant bonus de race) et la methode utilisee. Le serveur verifie tout.

export const SchemaCreationGuidee = z.strictObject({
  nom: z.string().trim().min(2, "Le nom doit faire au moins 2 caracteres.").max(24, "Le nom fait 24 caracteres au plus."),
  faction: schemaIdReferentiel,
  race: schemaIdReferentiel,
  classe: schemaIdReferentiel,
  methode: z.enum(METHODES_CARACTERISTIQUES),
  caracteristiques: SchemaCaracteristiques,
  bonusAuChoix: z.array(z.enum(CARACTERISTIQUES)).max(6).default([]),
  portrait: schemaPortrait.nullable().default(null),
  sexe: z.enum(SEXES).nullable().default(null),
  // Regles du livre (D&D 2024) :
  historique: schemaIdReferentiel.nullable().default(null),
  repartition: z.partialRecord(z.enum(CARACTERISTIQUES), entier(1, 2)).default({}), // bonus d'historique
  options: z.record(schemaIdReferentiel, schemaIdReferentiel).default({}), // { lignee: "elfe-de-sang" }
  specialisation: schemaIdReferentiel.nullable().default(null),
  donSupplementaire: schemaIdReferentiel.nullable().default(null), // Humain : un don d'origine en plus
  langues: z.array(schemaIdReferentiel).max(10).default([]), // langues choisies dans la table de sa faction
  ignorerLore: z.boolean().default(false), // possible seulement si le MJ l'autorise a cette table
});

// --- Creation libre par le MJ (outils du MJ : PNJ, monstres, fiches existantes) -------

export const SchemaCreationPersonnage = z.strictObject({
  nom: z.string().trim().min(1, "Le personnage doit avoir un nom.").max(60),
  classe: schemaIdReferentiel,
  niveau: entier(1, 20).default(1),
  caracteristiques: SchemaCaracteristiques,
  race: schemaIdReferentiel.optional(), // un monstre n'a pas forcement de race jouable
  // Optionnels : si absents, le serveur applique les regles par defaut.
  classeArmure: entier(1, 40).optional(),
  pvMax: entier(1, 999).optional(),
  // Attribuer la fiche a un joueur. Absent = PNJ du MJ.
  proprietaire: z.string().trim().min(2).max(24).optional(),
});

/** Les elements du referentiel cites par une demande, ou une erreur claire. */
function exigerDansReferentiel(referentiel, { classe, race, faction }) {
  const trouvee = { classe: referentiel.obtenirClasse(classe), race: null, faction: null };
  if (!trouvee.classe) throw new ErreurRegle(`Classe inconnue du referentiel : "${classe}".`);
  if (race !== undefined) {
    trouvee.race = referentiel.obtenirRace(race);
    if (!trouvee.race) throw new ErreurRegle(`Race inconnue du referentiel : "${race}".`);
  }
  if (faction !== undefined) {
    trouvee.faction = referentiel.obtenirFaction(faction);
    if (!trouvee.faction) throw new ErreurRegle(`Faction inconnue du referentiel : "${faction}".`);
  }
  return trouvee;
}

function ficheNeuve({
  idTable,
  proprietaire,
  nom,
  classe,
  race,
  faction,
  portrait,
  sexe = null,
  niveau,
  caracteristiques,
  classeArmure,
  pvMaximum,
  ressources,
  origine = null,
  langues = [],
  renommees = [],
}) {
  const maintenant = new Date().toISOString();
  return SchemaPersonnage.parse({
    versionSchema: VERSION_FICHE,
    id: nouvelId("p"),
    idTable,
    proprietaire,
    nom,
    classe: classe.id,
    race: race?.id ?? null,
    faction: faction?.id ?? null,
    portrait,
    sexe,
    niveau,
    caracteristiques,
    classeArmure, // sans armure : l'equipement viendra plus tard
    pointsDeVie: { max: pvMaximum, actuels: pvMaximum, temporaires: 0 },
    desDeVie: { faces: classe.deDeVie, restants: niveau },
    ressources,
    inventaire: [],
    equipement: {},
    barreActions: barreVide(),
    grimoire: [],
    etats: [],
    repose: false,
    attaquesMonstre: [],
    jeton: null,
    origine,
    langues,
    renommees,
    creeLe: maintenant,
    modifieLe: maintenant,
  });
}

/**
 * Creation guidee (joueur) : applique les regles du referentiel.
 * "portraits" = les fichiers disponibles dans le dossier portraits/.
 * "methodes" = les methodes de caracteristiques permises a la table (par defaut :
 * toutes celles du referentiel) ; "valeursTirage" = le tirage aux des du joueur,
 * garde par le serveur.
 */
export function fabriquerPersonnageGuide(
  entree,
  { idTable, proprietaire, referentiel, portraits = [], loreLibre = false, methodes = null, valeursTirage = null },
) {
  const choix = SchemaCreationGuidee.parse(entree);
  const { classe, race, faction } = exigerDansReferentiel(referentiel, choix);
  const regles = referentiel.reglesCreation();
  const tout = referentiel.lister();

  // Lore libre : seulement si le joueur l'a coche ET si le MJ l'autorise a cette table.
  if (choix.ignorerLore && !loreLibre) throw new ErreurRegle("Le MJ n'autorise pas le lore libre a cette table.");
  const lore = choix.ignorerLore || !regles.restrictionsRaceClasse;

  if (!raceDisponible(race, faction.id, lore)) throw new ErreurRegle(`${race.nom} : peuple indisponible pour la faction ${faction.nom}.`);
  const probleme =
    verifierOptions(race, choix.options, faction.id, lore) ??
    (lore ? null : restrictionDeLore(classe, race, choix.options)) ??
    verifierBase(choix.methode, choix.caracteristiques, regles, { methodes: methodes ?? regles.methodes, valeursTirage }) ??
    verifierChoixBonus(race, choix.bonusAuChoix);
  if (probleme) throw new ErreurRegle(probleme);

  // Historique : obligatoire des que le referentiel en propose.
  const historique = choix.historique ? referentiel.obtenirHistorique(choix.historique) : null;
  if (choix.historique && !historique) throw new ErreurRegle(`Historique inconnu du referentiel : "${choix.historique}".`);
  if (tout.historiques.length && !historique) throw new ErreurRegle("Choisis un historique.");
  if (historique) {
    const erreur = verifierRepartitionHistorique(historique, choix.repartition);
    if (erreur) throw new ErreurRegle(erreur);
  } else if (Object.keys(choix.repartition).length) {
    throw new ErreurRegle("Bonus d'historique sans historique.");
  }

  // Specialisation : obligatoire si la classe en propose.
  if (classe.specialisations.length && !classe.specialisations.some((s) => s.id === choix.specialisation)) {
    throw new ErreurRegle(`${classe.nom} : choisis une specialisation.`);
  }
  if (!classe.specialisations.length && choix.specialisation) throw new ErreurRegle(`${classe.nom} n'a pas de specialisation.`);

  // Langues : le joueur les choisit dans la table de sa faction (etape 3).
  const contexteOrigine = { race, classe, choixOptions: choix.options, idFaction: faction.id };
  const erreurLangues = verifierLangues(choix.langues, languesProposees(contexteOrigine, tout), regles.languesAuChoix);
  if (erreurLangues) throw new ErreurRegle(erreurLangues);

  // Dons : celui de l'historique, plus un don d'origine au choix pour un Humain.
  const dons = historique ? [historique.donOrigine] : [];
  if (race.donOrigineSupplementaire) {
    const don = choix.donSupplementaire ? referentiel.obtenirDon(choix.donSupplementaire) : null;
    if (!don) throw new ErreurRegle(`${race.nom} : choisis un don d'origine supplementaire.`);
    if (don.categorie !== "origine") throw new ErreurRegle(`${don.nom} n'est pas un don d'origine.`);
    if (don.races && !don.races.includes(race.id)) throw new ErreurRegle(`${don.nom} : reserve a d'autres peuples.`);
    dons.push(don.id);
  } else if (choix.donSupplementaire) {
    throw new ErreurRegle(`${race.nom} n'a pas de don d'origine supplementaire.`);
  }
  if (choix.portrait !== null && !portraits.includes(choix.portrait)) throw new ErreurRegle("Portrait introuvable dans le dossier portraits.");

  const apercu = apercuPersonnage(
    { race, classe, base: choix.caracteristiques, bonusAuChoix: choix.bonusAuChoix, repartition: choix.repartition, choixOptions: choix.options },
    tout,
  );
  return ficheNeuve({
    idTable,
    proprietaire,
    nom: choix.nom,
    classe,
    race,
    faction,
    portrait: choix.portrait,
    sexe: choix.sexe,
    niveau: 1,
    caracteristiques: apercu.caracteristiques,
    classeArmure: apercu.classeArmure,
    pvMaximum: apercu.pvMax,
    ressources: apercu.ressources,
    origine: {
      historique: historique?.id ?? null,
      optionsRace: choix.options,
      specialisation: choix.specialisation,
      sousClasse: classe.sousClasseCreation ?? null,
      dons,
      taille: apercu.taille,
      typeCreature: apercu.typeCreature,
      apparence: apercu.apparence,
      renommee: apercu.renommee,
    },
    langues: choix.langues,
    renommees: renommeesDeDepart(contexteOrigine, tout),
  });
}

/** Creation libre (MJ) : les caracteristiques sont prises telles quelles, sans bonus de race. */
export function fabriquerPersonnage(entree, { idTable, proprietaire, referentiel }) {
  const demande = SchemaCreationPersonnage.parse(entree);
  const { classe, race } = exigerDansReferentiel(referentiel, demande);
  const { niveau, caracteristiques } = demande;
  const modeles = Object.fromEntries(referentiel.lister().ressources.map((r) => [r.id, r]));
  return ficheNeuve({
    idTable,
    proprietaire,
    nom: demande.nom,
    classe,
    race,
    faction: null,
    portrait: null,
    niveau,
    caracteristiques,
    classeArmure: demande.classeArmure ?? classeArmureSansArmure(classe, caracteristiques),
    pvMaximum: demande.pvMax ?? pvMax(classe.deDeVie, niveau, caracteristiques.constitution, race?.pvParNiveau ?? 0),
    // Les ressources de depart de sa classe (Mana, emplacements de sorts...), quel
    // que soit son niveau : le MJ ajuste ensuite les maximums (menu clic droit).
    ressources: ressourcesDeDepart(classe, caracteristiques, modeles),
  });
}

/**
 * Un monstre du bestiaire (compendium, section "monstres") devient une fiche
 * de PNJ. Il n'a ni race ni classe jouable : sa "classe" est "monstre".
 * "pv" : deja tires par l'appelant (un nombre, meme si le modele donne "5d8").
 */
/**
 * L'image du pion d'un monstre : son "jeton" (dossier jetons/) s'il est donne,
 * sinon l'icone choisie dans le bestiaire, sinon jetons/<id> (initiales si absent).
 */
export const jetonDuModele = (modele) => modele.jeton ?? (modele.icone ? `icones/${modele.icone}` : modele.id);

export function fabriquerMonstre(modele, { idTable, nom, pv }) {
  const fiche = ficheNeuve({
    idTable,
    proprietaire: null,
    nom,
    classe: { id: "monstre", deDeVie: 8 },
    race: null,
    faction: null,
    portrait: null,
    niveau: modele.niveau,
    caracteristiques: modele.caracteristiques,
    classeArmure: modele.classeArmure,
    pvMaximum: Math.max(1, Math.min(999, pv)),
    ressources: [],
  });
  // Ses attaques, deja posees sur sa barre d'actions (le MJ n'a plus qu'a cliquer).
  const attaquesMonstre = modele.attaques.slice(0, 10).map(({ nom: n, toucher, degats, type }) => ({ nom: n, toucher, degats, type }));
  const barreActions = barreVide().map((_, i) => (attaquesMonstre[i] ? { type: "attaque", reference: attaquesMonstre[i].nom } : null));
  return SchemaPersonnage.parse({ ...fiche, attaquesMonstre, barreActions, jeton: jetonDuModele(modele), rang: modele.rang ?? "normal" });
}

/**
 * Version envoyee aux navigateurs : la fiche stockee + des valeurs CALCULEES
 * (modificateurs, bonus de maitrise). On ne stocke pas ce qui se deduit :
 * impossible ainsi d'avoir une Force de 16 avec un modificateur incoherent.
 */
export function presenterPersonnage(personnage) {
  return {
    ...personnage,
    derives: {
      modificateurs: Object.fromEntries(
        CARACTERISTIQUES.map((nom) => [nom, modificateur(personnage.caracteristiques[nom])]),
      ),
      bonusDeMaitrise: bonusDeMaitrise(personnage.niveau),
      bonusInitiative: modificateur(personnage.caracteristiques.dexterite),
      attaques: attaquesEquipees(personnage), // armes en main : bonus au toucher et degats
    },
  };
}

/**
 * La sante d'un monstre telle que les joueurs la voient : un pourcentage
 * ARRONDI a la dizaine (comme la barre de vie d'une cible dans WoW), jamais
 * ses points de vie exacts. 1 % minimum tant qu'il est debout.
 */
export function santeVisible(personnage) {
  const { actuels, max } = personnage.pointsDeVie;
  if (actuels <= 0) return 0;
  return Math.max(1, Math.min(100, Math.round((actuels / max) * 10) * 10));
}
