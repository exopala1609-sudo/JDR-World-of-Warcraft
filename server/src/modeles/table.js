// Une "table" = une session de jeu (une campagne, un one-shot...).
// Chaque table correspond a un dossier dans parties/, et a un salon temps reel.
import { z } from "./zod.js";
import { nouvelId, schemaId } from "./identifiants.js";
import { METHODES_CARACTERISTIQUES } from "./referentiel.js";

// Les reglages de la table, choisis par le MJ.
//   joueursModifientPv : true  = chaque joueur peut modifier lui-meme les PV,
//                                ressources et etats de SON personnage ;
//                        false = seul le MJ le peut (les sorts, attaques et
//                                repos calcules par le serveur s'appliquent
//                                toujours normalement).
//   loreLibre : true = les joueurs PEUVENT cocher "Ignorer les restrictions
//               de lore" a la creation (classe ou peuple hors lore).
//   methodes : les methodes de caracteristiques permises a cette table
//              (null = toutes celles du referentiel).
export const REGLAGES_PAR_DEFAUT = { joueursModifientPv: false, loreLibre: false, methodes: null };

export const SchemaReglagesTable = z.strictObject({
  joueursModifientPv: z.boolean(),
  loreLibre: z.boolean().default(false), // absent des tables d'avant l'etape 1
  methodes: z.array(z.enum(METHODES_CARACTERISTIQUES)).min(1, "Garde au moins une methode.").nullable().default(null),
});

// Ce que le MJ change d'un coup (outil de sa barre) : seulement les champs
// envoyes. (Pas de valeurs par defaut ici : elles ecraseraient les autres reglages.)
export const SchemaChangementReglages = z.strictObject({
  joueursModifientPv: z.boolean().optional(),
  loreLibre: z.boolean().optional(),
  methodes: z.array(z.enum(METHODES_CARACTERISTIQUES)).min(1, "Garde au moins une methode.").nullable().optional(),
});

// Le tirage aux des d'un joueur en cours de creation (cle : pseudo en minuscules).
// "retenu" = l'index du tirage garde (le meilleur) ; "relancesRestantes" : 2
// offertes au depart, plus celles accordees par le MJ.
export const SchemaTirage = z.strictObject({
  pseudo: z.string().trim().min(1).max(24),
  tirages: z.array(z.array(z.number().int().min(3).max(18)).length(6)).min(1).max(20),
  retenu: z.number().int().min(0),
  relancesRestantes: z.number().int().min(0).max(20),
});

export const SchemaTable = z.strictObject({
  id: schemaId("t"),
  nom: z.string().trim().min(1).max(60),
  creeLe: z.iso.datetime(),
  // Absent des tables d'avant le lot 2 : les reglages par defaut s'appliquent.
  reglages: SchemaReglagesTable.default(REGLAGES_PAR_DEFAUT),
  // Tirages aux des des joueurs qui creent leur personnage (absent : aucun).
  tirages: z.record(z.string(), SchemaTirage).default({}),
});

export const SchemaCreationTable = z.strictObject({
  nom: z.string().trim().min(1, "Donne un nom a la table.").max(60),
});

export function fabriquerTable(entree) {
  const { nom } = SchemaCreationTable.parse(entree);
  return SchemaTable.parse({ id: nouvelId("t"), nom, creeLe: new Date().toISOString(), reglages: { ...REGLAGES_PAR_DEFAUT } });
}
