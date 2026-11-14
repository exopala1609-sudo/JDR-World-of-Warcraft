// Le journal de quetes d'une table : les quetes que le MJ a "poussees" au
// groupe. Sauvegarde dans parties/<table>/quetes.json (dans ton cloud).
import { schemaId } from "./identifiants.js";
import { z } from "./zod.js";

export const STATUTS_QUETE = /** @type {const} */ (["en-cours", "terminee", "echouee"]);

export const SchemaQuete = z.strictObject({
  id: schemaId("q"),
  titre: z.string().trim().min(1, "La quete doit avoir un titre.").max(80),
  objectif: z.string().trim().min(1, "Indique l'objectif de la quete.").max(500),
  description: z.string().trim().max(4000).default(""),
  statut: z.enum(STATUTS_QUETE),
  creeLe: z.iso.datetime(),
});

export const SchemaJournalQuetes = z.strictObject({
  idTable: schemaId("t"),
  quetes: z.array(SchemaQuete).max(200),
});
