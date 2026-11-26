// Une "table" = une session de jeu (une campagne, un one-shot...).
// Chaque table correspond a un dossier dans parties/, et a un salon temps reel.
import { z } from "./zod.js";
import { nouvelId, schemaId } from "./identifiants.js";

// Les reglages de la table, choisis par le MJ.
//   joueursModifientPv : true  = chaque joueur peut modifier lui-meme les PV,
//                                ressources et etats de SON personnage ;
//                        false = seul le MJ le peut (les sorts, attaques et
//                                repos calcules par le serveur s'appliquent
//                                toujours normalement).
//   loreLibre : true = les joueurs PEUVENT cocher "Ignorer les restrictions
//               de lore" a la creation (classe ou peuple hors lore).
export const REGLAGES_PAR_DEFAUT = { joueursModifientPv: false, loreLibre: false };

export const SchemaReglagesTable = z.strictObject({
  joueursModifientPv: z.boolean(),
  loreLibre: z.boolean().default(false), // absent des tables d'avant l'etape 1
});

export const SchemaTable = z.strictObject({
  id: schemaId("t"),
  nom: z.string().trim().min(1).max(60),
  creeLe: z.iso.datetime(),
  // Absent des tables d'avant le lot 2 : les reglages par defaut s'appliquent.
  reglages: SchemaReglagesTable.default(REGLAGES_PAR_DEFAUT),
});

export const SchemaCreationTable = z.strictObject({
  nom: z.string().trim().min(1, "Donne un nom a la table.").max(60),
});

export function fabriquerTable(entree) {
  const { nom } = SchemaCreationTable.parse(entree);
  return SchemaTable.parse({ id: nouvelId("t"), nom, creeLe: new Date().toISOString(), reglages: { ...REGLAGES_PAR_DEFAUT } });
}
