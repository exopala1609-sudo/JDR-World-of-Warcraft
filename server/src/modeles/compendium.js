// Forme des fichiers du compendium (dossier compendium/ de ton cloud).
//
// Un fichier de compendium est un fichier .json qui peut contenir trois listes :
//   { "objets": [ ... ], "sorts": [ ... ], "etats": [ ... ] }
// Tu peux ranger comme tu veux : un gros fichier, ou un par theme
// ("armes.json", "sorts-de-mage.json"...), dans des sous-dossiers si tu veux.
//
// Chaque entree a un "id" que TU choisis (ex. "epee-longue") : c'est son nom
// technique, stable, qui sert a la retrouver (glisser-deposer, sauvegardes...).
import { CARACTERISTIQUES } from "../../../shared/dnd5e.js";
import { TYPES_EMPLACEMENT } from "../../../shared/equipement.js";
import { CLES_RARETES } from "../../../shared/raretes.js";
import { NATURES_ETAT } from "../../../shared/etats.js";
import { lancerDes } from "../regles/des.js";
import { z } from "./zod.js";

const entier = (min, max) => z.int().min(min).max(max);

export const schemaIdCompendium = z
  .string()
  .regex(/^[a-z0-9-]{1,60}$/, "Identifiant : minuscules, chiffres et tirets uniquement (ex. epee-longue).");

// Une icone = un nom de fichier (sans extension) du dossier icones/.
const schemaIcone = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, "Nom d'icone invalide.");

// Une formule de des est verifiee en la lancant une fois "a blanc".
const schemaFormule = z.string().refine((formule) => {
  try {
    lancerDes(formule);
    return true;
  } catch {
    return false;
  }
}, "Formule de des invalide (ex. 1d8+2).");

export const TYPES_OBJET = /** @type {const} */ ([
  "arme",
  "armure",
  "bouclier",
  "consommable",
  "munition",
  "objet",
  "tresor",
]);

export const ECOLES_MAGIE = /** @type {const} */ ([
  "abjuration",
  "divination",
  "enchantement",
  "evocation",
  "illusion",
  "invocation",
  "necromancie",
  "transmutation",
]);

// --- Objets ---------------------------------------------------------------------

/** Tout ce qui decrit un objet, qu'il soit dans le compendium ou dans un sac. */
export const champsObjet = {
  nom: z.string().trim().min(1).max(80),
  type: z.enum(TYPES_OBJET),
  // La rarete facon WoW : c'est elle qui donnera la couleur de bordure.
  rarete: z.enum(CLES_RARETES, "Rarete : mediocre, classique, inhabituel, rare, epique ou legendaire."),
  icone: schemaIcone.optional(),
  poids: z.number().min(0).max(10_000).default(0), // en kg
  valeur: z.number().min(0).max(1_000_000).default(0), // en pieces d'or
  empilable: z.boolean().default(false), // potions, fleches... se regroupent
  description: z.string().max(4000).default(""),
  arme: z
    .strictObject({
      degats: schemaFormule,
      typeDegats: z.string().trim().min(1).max(30),
      proprietes: z.array(z.string().trim().max(60)).max(10).default([]),
    })
    .optional(),
  armure: z
    .strictObject({
      classeArmure: entier(0, 30),
      categorie: z.enum(["legere", "intermediaire", "lourde", "bouclier"]),
      dexteriteMax: entier(0, 10).optional(),
    })
    .optional(),
  soins: schemaFormule.optional(), // ex. potion : "2d4+2"
  // Ou l'objet se porte (voir docs/COMPENDIUM.md). Absent : deduit du type
  // (arme -> une main, bouclier -> main gauche, armure -> torse...).
  emplacement: z.enum(TYPES_EMPLACEMENT, "Emplacement inconnu (voir docs/COMPENDIUM.md).").optional(),
};

export const SchemaEntreeObjet = z.strictObject({ id: schemaIdCompendium, ...champsObjet });

// --- Sorts ------------------------------------------------------------------------

export const champsSort = {
  nom: z.string().trim().min(1).max(80),
  niveau: entier(0, 9), // 0 = sort mineur
  ecole: z.enum(ECOLES_MAGIE),
  icone: schemaIcone.optional(),
  incantation: z.string().trim().max(60).default("1 action"),
  portee: z.string().trim().max(60).default(""),
  composantes: z.string().trim().max(120).default(""),
  duree: z.string().trim().max(60).default("Instantanee"),
  concentration: z.boolean().default(false),
  rituel: z.boolean().default(false),
  description: z.string().max(4000).default(""),
  degats: z.strictObject({ formule: schemaFormule, type: z.string().trim().min(1).max(30) }).optional(),
  soins: schemaFormule.optional(),
  // Comment le sort se resout (voir shared/magie.js) : "attaque" (jet d'attaque
  // de sort), "sauvegarde" (la cible resiste : indiquer "sauvegarde"), ou
  // "automatique" (touche toujours, soigne). Absent : deduit (degats -> attaque).
  resolution: z.enum(["attaque", "sauvegarde", "automatique"]).optional(),
  sauvegarde: z.enum(CARACTERISTIQUES).optional(), // ex. "dexterite" pour la Boule de feu
  // Cout dans une ressource facon WoW (ex. 15 points de Mana).
  cout: z
    .strictObject({ ressource: z.string().regex(/^[a-z0-9-]{1,40}$/), quantite: entier(1, 999) })
    .optional(),
};

export const SchemaEntreeSort = z.strictObject({ id: schemaIdCompendium, ...champsSort });

// --- Etats (auras / debuffs personnalises) ----------------------------------------

export const SchemaDefinitionEtat = z.strictObject({
  id: schemaIdCompendium,
  nom: z.string().trim().min(1).max(60),
  nature: z.enum(NATURES_ETAT),
  icone: schemaIcone.optional(),
  description: z.string().max(1000).default(""),
  dureeParDefaut: entier(1, 100).optional(), // en rounds
});

// --- Monstres (le bestiaire du MJ) -----------------------------------------------------
// Un modele de monstre : chaque "invocation" (glisser depuis le Bestiaire vers
// la carte) fabrique une fiche de PNJ a partir de ce modele.

const schemaCaracMonstre = entier(1, 30).default(10);

export const SchemaEntreeMonstre = z.strictObject({
  id: schemaIdCompendium,
  nom: z.string().trim().min(1).max(50),
  type: z.string().trim().max(60).default(""), // ex. "Humanoide (gnoll)", "Bete", "Mort-vivant"
  puissance: z.string().trim().max(20).default(""), // ex. "FP 1/2" (affichage seulement)
  niveau: entier(1, 20).default(1), // sert au bonus de maitrise
  // Points de vie : un nombre fixe (22), ou une formule tiree a chaque invocation ("5d8").
  pv: z.union([entier(1, 999), schemaFormule], "pv : un nombre (22) ou une formule (\"5d8\")."),
  classeArmure: entier(1, 40),
  vitesse: z.string().trim().max(40).default("9 m"),
  caracteristiques: z
    .strictObject(Object.fromEntries(CARACTERISTIQUES.map((c) => [c, schemaCaracMonstre])))
    .default(Object.fromEntries(CARACTERISTIQUES.map((c) => [c, 10]))),
  // Attaques : affichees dans le bestiaire (le MJ lance avec le lanceur de des).
  attaques: z
    .array(
      z.strictObject({
        nom: z.string().trim().min(1).max(60),
        toucher: entier(-5, 30),
        degats: schemaFormule,
        type: z.string().trim().max(30).default(""),
      }),
    )
    .max(10)
    .default([]),
  // Objets du compendium portes par le monstre : on les trouve sur son cadavre.
  butin: z
    .array(z.strictObject({ id: schemaIdCompendium, quantite: entier(1, 999).default(1) }))
    .max(20)
    .default([]),
  icone: schemaIcone.optional(), // image du dossier icones/ (par defaut : l'id)
  jeton: schemaIcone.optional(), // image du pion, dossier jetons/ (par defaut : l'id)
  // Taille du pion en cases : 1 (petite / moyenne), 2 (grande), 3 (tres grande), 4 (gigantesque).
  taille: entier(1, 4).default(1),
  // Rang (cadre de cible facon WoW) : normal, elite (dragon dore), rare (dragon d'argent), boss.
  rang: z.enum(["normal", "elite", "rare", "boss"]).default("normal"),
  description: z.string().max(2000).default(""),
});
