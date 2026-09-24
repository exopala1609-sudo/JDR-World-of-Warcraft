// Modele d'un personnage de D&D 5e.
//
// Deux schemas, deux usages :
//  - SchemaPersonnage          : la fiche COMPLETE, telle qu'elle est stockee ;
//  - SchemaCreationPersonnage  : ce qu'un navigateur a le DROIT d'envoyer
//                                pour creer un personnage (et rien de plus).
// Le serveur calcule lui-meme le reste (PV max, CA, ressources...) : un
// joueur ne peut pas s'attribuer 999 PV en trafiquant sa requete.
import { z } from "./zod.js";
import {
  CARACTERISTIQUES,
  CLASSES,
  RARETES,
  RECUPERATIONS,
  bonusDeMaitrise,
  classeArmureSansArmure,
  modificateur,
  ressourcesDeDepart,
} from "../../../shared/dnd5e.js";
import { nouvelId, schemaId } from "./identifiants.js";

const entier = (min, max) => z.int().min(min).max(max);

// --- Briques ---------------------------------------------------------------

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

export const SchemaRessource = z
  .strictObject({
    cle: z.string().regex(/^[a-z0-9-]{1,40}$/),
    nom: z.string().trim().min(1).max(60),
    actuel: entier(0, 99),
    max: entier(0, 99),
    recuperation: z.enum(RECUPERATIONS),
  })
  .refine((r) => r.actuel <= r.max, "Une ressource ne peut pas depasser son maximum.");

export const SchemaObjet = z.strictObject({
  id: schemaId("o"),
  nom: z.string().trim().min(1).max(80),
  quantite: entier(1, 9999),
  rarete: z.enum(RARETES),
  poids: z.number().min(0).max(10_000),
  description: z.string().max(2000),
});

// --- La fiche complete -------------------------------------------------------

export const SchemaPersonnage = z.strictObject({
  id: schemaId("p"),
  idTable: schemaId("t"),
  // Pseudo du joueur a qui appartient la fiche, ou null pour un PNJ du MJ.
  proprietaire: z.string().nullable(),
  nom: z.string().trim().min(1).max(60),
  classe: z.enum(Object.keys(CLASSES)),
  niveau: entier(1, 20),
  caracteristiques: SchemaCaracteristiques,
  classeArmure: entier(1, 40),
  pointsDeVie: SchemaPointsDeVie,
  desDeVie: z.strictObject({ faces: z.literal([6, 8, 10, 12]), restants: entier(0, 20) }),
  ressources: z.array(SchemaRessource).max(30),
  inventaire: z.array(SchemaObjet).max(500),
  creeLe: z.iso.datetime(),
  modifieLe: z.iso.datetime(),
});

// --- Ce que le navigateur peut envoyer a la creation -------------------------

export const SchemaCreationPersonnage = z.strictObject({
  nom: z.string().trim().min(1, "Le personnage doit avoir un nom.").max(60),
  classe: z.enum(Object.keys(CLASSES), "Classe inconnue."),
  niveau: entier(1, 20).default(1),
  caracteristiques: SchemaCaracteristiques,
  // Optionnels : si absents, le serveur applique les regles par defaut.
  classeArmure: entier(1, 40).optional(),
  pvMax: entier(1, 999).optional(),
  // Reserve au MJ : attribuer la fiche a un joueur. Absent = PNJ du MJ.
  proprietaire: z.string().trim().min(2).max(24).optional(),
});

/**
 * PV max selon la regle "valeur fixe" du Manuel des joueurs :
 * niveau 1 = de de vie complet + mod. CON ; ensuite moyenne arrondie
 * au superieur + mod. CON par niveau (minimum 1 PV gagne par niveau).
 */
export function calculerPvMax(classe, niveau, constitution) {
  const faces = CLASSES[classe].deDeVie;
  const modCon = modificateur(constitution);
  const premierNiveau = Math.max(1, faces + modCon);
  const parNiveauSuivant = Math.max(1, faces / 2 + 1 + modCon);
  return premierNiveau + (niveau - 1) * parNiveauSuivant;
}

/** Transforme une demande de creation en fiche complete et valide. */
export function fabriquerPersonnage(entree, { idTable, proprietaire }) {
  const demande = SchemaCreationPersonnage.parse(entree);
  const { classe, niveau, caracteristiques } = demande;
  const pvMax = demande.pvMax ?? calculerPvMax(classe, niveau, caracteristiques.constitution);
  const maintenant = new Date().toISOString();

  return SchemaPersonnage.parse({
    id: nouvelId("p"),
    idTable,
    proprietaire,
    nom: demande.nom,
    classe,
    niveau,
    caracteristiques,
    // Sans armure (l'equipement viendra plus tard, avec l'inventaire).
    classeArmure: demande.classeArmure ?? classeArmureSansArmure(classe, caracteristiques),
    pointsDeVie: { max: pvMax, actuels: pvMax, temporaires: 0 },
    desDeVie: { faces: CLASSES[classe].deDeVie, restants: niveau },
    ressources: niveau === 1 ? ressourcesDeDepart(classe, caracteristiques) : [],
    inventaire: [],
    creeLe: maintenant,
    modifieLe: maintenant,
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
    },
  };
}
