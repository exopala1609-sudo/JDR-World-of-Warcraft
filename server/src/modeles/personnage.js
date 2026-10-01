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
import { apercuPersonnage, classeArmureSansArmure, pvMax, ressourcesDeDepart, verifierBase, verifierChoixBonus } from "../../../shared/creation.js";
import { CARACTERISTIQUES, bonusDeMaitrise, modificateur } from "../../../shared/dnd5e.js";
import { attaquesEquipees, IDS_EMPLACEMENTS, TAILLE_BARRE } from "../../../shared/equipement.js";
import { NATURES_ETAT } from "../../../shared/etats.js";
import { MODES_REPOS, TYPES_RESSOURCE } from "../../../shared/ressources.js";
import { champsObjet, champsSort, schemaIdCompendium } from "./compendium.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { nouvelId, schemaId } from "./identifiants.js";
import { METHODES_CARACTERISTIQUES, schemaIdReferentiel } from "./referentiel.js";
import { z } from "./zod.js";

// Version du format des fiches. Si elle change, modeles/migrations.js sait
// convertir les anciennes fiches : aucune sauvegarde n'est jamais perdue.
export const VERSION_FICHE = 5;

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
  type: z.enum(["objet", "sort"]),
  reference: z.string().min(1).max(80), // l'origine dans le compendium, ou l'identifiant de l'objet / du sort
});
export const SchemaBarreActions = z.array(SchemaRaccourci.nullable()).length(TAILLE_BARRE);
export const barreVide = () => Array(TAILLE_BARRE).fill(null);

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

function ficheNeuve({ idTable, proprietaire, nom, classe, race, faction, portrait, niveau, caracteristiques, classeArmure, pvMaximum, ressources }) {
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
    creeLe: maintenant,
    modifieLe: maintenant,
  });
}

/**
 * Creation guidee (joueur) : applique les regles du referentiel.
 * "portraits" = les fichiers disponibles dans le dossier portraits/.
 */
export function fabriquerPersonnageGuide(entree, { idTable, proprietaire, referentiel, portraits = [] }) {
  const choix = SchemaCreationGuidee.parse(entree);
  const { classe, race, faction } = exigerDansReferentiel(referentiel, choix);
  const regles = referentiel.reglesCreation();

  if (!race.factions.includes(faction.id)) throw new ErreurRegle(`${race.nom} : race indisponible pour la faction ${faction.nom}.`);
  if (!referentiel.combinaisonPermise(race.id, classe.id)) {
    throw new ErreurRegle(`${race.nom} : la classe ${classe.nom} n'est pas accessible a cette race.`);
  }
  const probleme = verifierBase(choix.methode, choix.caracteristiques, regles) ?? verifierChoixBonus(race, choix.bonusAuChoix);
  if (probleme) throw new ErreurRegle(probleme);
  if (choix.portrait !== null && !portraits.includes(choix.portrait)) throw new ErreurRegle("Portrait introuvable dans le dossier portraits.");

  const apercu = apercuPersonnage({ race, classe, base: choix.caracteristiques, bonusAuChoix: choix.bonusAuChoix }, referentiel.lister());
  return ficheNeuve({
    idTable,
    proprietaire,
    nom: choix.nom,
    classe,
    race,
    faction,
    portrait: choix.portrait,
    niveau: 1,
    caracteristiques: apercu.caracteristiques,
    classeArmure: apercu.classeArmure,
    pvMaximum: apercu.pvMax,
    ressources: apercu.ressources,
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
    // Ressources de depart du niveau 1 ; la progression viendra avec la montee de niveau.
    ressources: niveau === 1 ? ressourcesDeDepart(classe, caracteristiques, modeles) : [],
  });
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
