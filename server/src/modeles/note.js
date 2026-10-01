// Le carnet de notes PRIVE de chaque participant d'une table (MJ compris).
// Sauvegarde dans parties/<table>/notes.json (dans ton cloud).
// Une seule regle : chacun ne lit et n'ecrit QUE ses propres notes. Meme le
// MJ ne lit pas les notes d'un joueur (c'est son carnet intime).
import { schemaId } from "./identifiants.js";
import { z } from "./zod.js";

export const SchemaNote = z.strictObject({
  id: schemaId("n"),
  titre: z.string().trim().min(1, "Donne un titre a ta note.").max(80),
  texte: z.string().max(10_000).default(""),
  modifieLe: z.iso.datetime(),
});

// Cle d'un auteur : "mj" pour le Maitre du Jeu, sinon "joueur:<pseudo normalise>".
export const SchemaCarnets = z.strictObject({
  idTable: schemaId("t"),
  carnets: z.record(z.string().regex(/^(mj|joueur:.{1,40})$/), z.array(SchemaNote).max(200)),
});
