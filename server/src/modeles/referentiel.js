// Forme des fichiers du REFERENTIEL (dossier referentiel/ de ton cloud).
//
// Le referentiel, ce sont les regles de creation de personnage ecrites en
// donnees plutot qu'en code : factions, races, classes, ressources (Mana,
// Rage...) et methode de caracteristiques. Quand le livre officiel sortira,
// il suffira de modifier ces fichiers : le code ne connait AUCUNE race ni
// AUCUNE classe par son nom.
//
// Un fichier du referentiel peut contenir une ou plusieurs de ces sections :
//   { "factions": [...], "races": [...], "classes": [...],
//     "ressources": [...], "creation": { ... } }
// Les liens entre sections (la faction d'une race, les ressources d'une
// classe...) sont verifies a la fin du chargement, dans donnees/referentiel.js.
import { CARACTERISTIQUES } from "../../../shared/dnd5e.js";
import { MODES_REPOS, TYPES_RESSOURCE } from "../../../shared/ressources.js";
import { z } from "./zod.js";

const entier = (min, max) => z.int().min(min).max(max);
const texte = (max) => z.string().trim().max(max).default("");

export const schemaIdReferentiel = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/, "Identifiant : minuscules, chiffres et tirets uniquement (ex. elfe-de-sang).");

const schemaNom = z.string().trim().min(1, "Le nom ne peut pas etre vide.").max(60);

// Une icone = un nom de fichier (sans extension) du dossier icones/.
const schemaIcone = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, "Nom d'icone : lettres, chiffres, - et _ (sans extension).");

const schemaCouleur = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRVVBB (ex. #c69b6d).");

const schemaCaracteristique = z.enum(
  CARACTERISTIQUES,
  "Caracteristique : force, dexterite, constitution, intelligence, sagesse ou charisme.",
);

const schemaRegleRepos = z.union(
  [z.enum(MODES_REPOS), z.strictObject({ ajouter: entier(1, 999) })],
  'Regle de repos : "aucun", "remplir", "vider", "moitie" ou { "ajouter": 2 }.',
);

// --- Factions ------------------------------------------------------------------

export const SchemaFaction = z.strictObject({
  id: schemaIdReferentiel,
  nom: schemaNom,
  description: texte(2000),
  embleme: schemaIcone.optional(), // par defaut : "faction-<id>"
  couleur: schemaCouleur.default("#ffd100"),
});

// --- Ressources (modeles de jauges et de compteurs) ------------------------------

export const SchemaModeleRessource = z.strictObject({
  id: schemaIdReferentiel,
  nom: schemaNom,
  type: z.enum(TYPES_RESSOURCE, 'Type : "jauge" (barre) ou "compteur" (petites cases).'),
  max: entier(0, 999),
  depart: z.enum(["plein", "vide"], 'Depart : "plein" ou "vide".').default("plein"),
  reposCourt: schemaRegleRepos,
  reposLong: schemaRegleRepos,
  couleur: schemaCouleur.optional(),
  description: texte(1000),
});

// --- Races -----------------------------------------------------------------------

const schemaBonusFixes = z
  .partialRecord(schemaCaracteristique, entier(-5, 5))
  .default({});

// Bonus que le JOUEUR repartit lui-meme (regles 2024) : ex. { "bonus": [2, 1] }
// = +2 a une caracteristique et +1 a une autre, au choix, parmi "parmi".
const schemaBonusAuChoix = z
  .strictObject({
    bonus: z.array(entier(1, 5)).min(1).max(6),
    parmi: z.union([z.literal("toutes"), z.array(schemaCaracteristique).min(1)]).default("toutes"),
  })
  .refine(
    ({ bonus, parmi }) => parmi === "toutes" || bonus.length <= parmi.length,
    "Chaque bonus va sur une caracteristique differente : la liste \"parmi\" est trop courte.",
  );

export const SchemaRace = z.strictObject({
  id: schemaIdReferentiel,
  nom: schemaNom,
  factions: z.array(schemaIdReferentiel).min(1, "Indique au moins une faction."),
  description: texte(4000),
  icone: schemaIcone.optional(), // par defaut : "race-<id>"
  taille: z.enum(["petite", "moyenne", "grande"], 'Taille : "petite", "moyenne" ou "grande".').default("moyenne"),
  vitesse: z
    .number()
    .min(1.5)
    .max(30)
    .refine((m) => Number.isInteger(m / 1.5), "Vitesse en metres, par pas de 1,5 m (ex. 9 ou 7.5).")
    .default(9),
  bonusCaracteristiques: schemaBonusFixes,
  bonusAuChoix: schemaBonusAuChoix.optional(),
  pvParNiveau: entier(0, 5).default(0),
  langues: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  traits: z
    .array(z.strictObject({ nom: schemaNom, description: texte(2000) }))
    .max(20)
    .default([]),
  classesAutorisees: z
    .union([z.literal("toutes"), z.array(schemaIdReferentiel).min(1)], 'Ecris "toutes" ou une liste ["guerrier", ...].')
    .default("toutes"),
});

// --- Classes ---------------------------------------------------------------------

// Maximum d'une ressource de depart : un nombre, ou "le modificateur d'une
// caracteristique, avec un minimum" (ex. Inspiration bardique = mod. CHA, min. 1).
const schemaMaxRessource = z.union([
  entier(0, 999),
  z.strictObject({ modificateur: schemaCaracteristique, minimum: entier(0, 999).default(1) }),
]);

export const SchemaClasse = z.strictObject({
  id: schemaIdReferentiel,
  nom: schemaNom,
  equivalentDnd: z.string().trim().max(60).optional(), // pour memoire, ex. "Roublard"
  description: texte(4000),
  icone: schemaIcone.optional(), // par defaut : "classe-<id>"
  couleur: schemaCouleur.default("#ffffff"),
  deDeVie: z.literal([6, 8, 10, 12], "Le de de vie doit etre 6, 8, 10 ou 12."),
  caracteristiquesPrincipales: z.array(schemaCaracteristique).max(6).default([]),
  defenseSansArmure: z.array(schemaCaracteristique).max(2).default([]),
  // Magie : caracteristique des sorts (jet d'attaque, DD) et rythme de progression.
  caracteristiqueIncantation: schemaCaracteristique.optional(),
  progressionSorts: z.enum(["complete", "demi"], 'progressionSorts : "complete" ou "demi".').default("complete"),
  ressources: z
    .array(
      z.strictObject({
        ressource: schemaIdReferentiel,
        max: schemaMaxRessource.optional(),
        reposCourt: schemaRegleRepos.optional(),
        reposLong: schemaRegleRepos.optional(),
      }),
    )
    .max(10)
    .default([]),
});

// --- Regles de creation (caracteristiques) -------------------------------------------

export const METHODES_CARACTERISTIQUES = /** @type {const} */ (["tableau-standard", "achat-de-points"]);

// Valeurs officielles de D&D 5e : elles s'appliquent si le fichier ne dit rien.
export const SchemaReglesCreation = z.strictObject({
  methodes: z
    .array(z.enum(METHODES_CARACTERISTIQUES, 'Methode : "tableau-standard" ou "achat-de-points".'))
    .min(1)
    .default(["tableau-standard", "achat-de-points"]),
  tableauStandard: z
    .array(entier(1, 20))
    .length(6, "Le tableau standard doit contenir exactement 6 valeurs.")
    .default([15, 14, 13, 12, 10, 8]),
  achatDePoints: z
    .strictObject({
      budget: entier(1, 200),
      couts: z
        .record(z.string().regex(/^\d{1,2}$/, "Les scores du tableau des couts s'ecrivent entre guillemets : \"8\"."), entier(0, 100))
        .refine((couts) => {
          const scores = Object.keys(couts).map(Number).sort((a, b) => a - b);
          return scores.length >= 2 && scores.every((s, i) => i === 0 || s === scores[i - 1] + 1);
        }, "Le tableau des couts doit donner un cout pour chaque score, sans trou (8, 9, 10...)."),
    })
    .default({ budget: 27, couts: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 } }),
  caracteristiqueMaximale: entier(10, 30).default(20),
  restrictionsRaceClasse: z.boolean().default(true),
});

export const REGLES_CREATION_PAR_DEFAUT = SchemaReglesCreation.parse({});
