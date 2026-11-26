// Un combat en cours sur une table : l'ordre d'initiative et le tour actif.
// Il est sauvegarde (combat.json dans le dossier de la table) : si le serveur
// redemarre en plein combat, on reprend exactement au meme tour.
import { schemaId } from "./identifiants.js";
import { z } from "./zod.js";

export const SchemaParticipant = z.strictObject({
  id: schemaId("c"),
  idPersonnage: schemaId("p"),
  nom: z.string().trim().min(1).max(60),
  jet: z.int().min(1).max(20), // le d20 lance par le serveur
  bonus: z.int().min(-10).max(20), // modificateur de Dexterite
  initiative: z.int().min(-20).max(60), // jet + bonus, ou valeur imposee par le MJ
  dexterite: z.int().min(1).max(30), // pour departager les egalites
  departage: z.int().min(0).max(1_000_000), // tirage au sort en dernier recours
});

export const SchemaCombat = z
  .strictObject({
    idTable: schemaId("t"),
    round: z.int().min(1).max(10_000),
    indexActif: z.int().min(0),
    participants: z.array(SchemaParticipant).min(1).max(60),
    demarreLe: z.iso.datetime(),
  })
  .refine((c) => c.indexActif < c.participants.length, "Tour actif invalide.");
