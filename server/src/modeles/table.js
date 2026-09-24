// Une "table" = une session de jeu (une campagne, un one-shot...).
// Chaque table correspond a un dossier dans parties/, et a un salon temps reel.
import { z } from "./zod.js";
import { nouvelId, schemaId } from "./identifiants.js";

export const SchemaTable = z.strictObject({
  id: schemaId("t"),
  nom: z.string().trim().min(1).max(60),
  creeLe: z.iso.datetime(),
});

export const SchemaCreationTable = z.strictObject({
  nom: z.string().trim().min(1, "Donne un nom a la table.").max(60),
});

export function fabriquerTable(entree) {
  const { nom } = SchemaCreationTable.parse(entree);
  return SchemaTable.parse({ id: nouvelId("t"), nom, creeLe: new Date().toISOString() });
}
