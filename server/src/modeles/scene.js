// La "scene" d'une table : la carte affichee, sa grille, ses pions et son
// brouillard de guerre. Sauvegardee dans parties/<table>/scene.json.
import { schemaId } from "./identifiants.js";
import { z } from "./zod.js";

// Carte factice (tant que le MJ n'a pas choisi d'image) : un carre de 2000 px.
export const CARTE_PAR_DEFAUT = { fichier: null, largeur: 2000, hauteur: 2000 };
export const GRILLE_PAR_DEFAUT = { taille: 100, decalageX: 0, decalageY: 0, visible: true };

export const LIMITES_BROUILLARD = {
  traits: 20_000, // au-dela, il faut "tout cacher" ou "tout reveler"
  pointsParTrait: 64,
  rayonMin: 5,
  rayonMax: 600,
};

const coordonnee = z.number().min(-100_000).max(100_000);

export const SchemaGrille = z.strictObject({
  taille: z.number().min(10).max(1000), // pixels de l'image par case (1,5 m)
  decalageX: z.number().min(-1000).max(1000),
  decalageY: z.number().min(-1000).max(1000),
  visible: z.boolean(),
});

export const SchemaPion = z.strictObject({
  id: schemaId("j"),
  idPersonnage: schemaId("p"),
  x: coordonnee,
  y: coordonnee,
  taille: z.int().min(1).max(4), // en cases (1 = creature de taille moyenne)
  couleur: z.string().regex(/^#[0-9a-f]{6}$/),
  cache: z.boolean(), // le MJ peut cacher un pion aux joueurs
});

export const SchemaTrait = z.union([
  z.strictObject({
    mode: z.enum(["reveler", "cacher"]),
    rayon: z.number().min(LIMITES_BROUILLARD.rayonMin).max(LIMITES_BROUILLARD.rayonMax),
    points: z.array(z.tuple([coordonnee, coordonnee])).min(1).max(LIMITES_BROUILLARD.pointsParTrait),
  }),
  z.strictObject({ mode: z.literal("tout-reveler") }),
]);

export const SchemaScene = z.strictObject({
  idTable: schemaId("t"),
  carte: z.strictObject({
    fichier: z.string().max(255).nullable(),
    largeur: z.int().min(1).max(20_000),
    hauteur: z.int().min(1).max(20_000),
  }),
  grille: SchemaGrille,
  pions: z.array(SchemaPion).max(200),
  brouillard: z.strictObject({
    actif: z.boolean(),
    traits: z.array(SchemaTrait).max(LIMITES_BROUILLARD.traits),
  }),
});

export function sceneVide(idTable) {
  return {
    idTable,
    carte: { ...CARTE_PAR_DEFAUT },
    grille: { ...GRILLE_PAR_DEFAUT },
    pions: [],
    brouillard: { actif: true, traits: [] }, // tout est noir au depart
  };
}
