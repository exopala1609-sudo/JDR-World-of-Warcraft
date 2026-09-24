// Forme des fichiers du compendium (dossier compendium/ de ton cloud).
//
// Un fichier de compendium est un fichier .json qui peut contenir trois listes :
//   { "objets": [ ... ], "sorts": [ ... ], "etats": [ ... ] }
// Tu peux ranger comme tu veux : un gros fichier, ou un par theme
// ("armes.json", "sorts-de-mage.json"...), dans des sous-dossiers si tu veux.
//
// Chaque entree a un "id" que TU choisis (ex. "epee-longue") : c'est son nom
// technique, stable, qui sert a la retrouver (glisser-deposer, sauvegardes...).
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
