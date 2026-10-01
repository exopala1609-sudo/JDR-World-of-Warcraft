// La magie : quels sorts un personnage peut lancer, avec quelle caracteristique,
// et comment ils se resolvent. Fichier PARTAGE : le grimoire grise ce que le
// serveur refuserait ; le serveur arbitre avec exactement le meme calcul.
import { bonusDeMaitrise, modificateur } from "./dnd5e.js";

/**
 * Niveau de sort le plus eleve qu'un personnage peut lancer (regles D&D 5e).
 *  - "complete" (Mage, Pretre...) : niveau 1 -> sorts de niv. 1, niveau 3 -> 2, ...
 *  - "demi" (Paladin, Chasseur) : rien au niveau 1, puis deux fois plus lentement.
 * Les sorts mineurs (niveau 0) sont toujours disponibles.
 */
export function niveauDeSortMax(niveau, progression = "complete") {
  const effectif = progression === "demi" ? (niveau < 2 ? 0 : Math.ceil(niveau / 2)) : niveau;
  return Math.min(9, Math.ceil(effectif / 2));
}

/** Le personnage connait-il assez la magie pour lancer ce sort ? */
export const sortDebloque = (sort, niveau, progression) => sort.niveau <= niveauDeSortMax(niveau, progression);

/** Niveau de personnage a partir duquel ce sort se debloque. */
export function niveauRequis(sort, progression = "complete") {
  for (let niveau = 1; niveau <= 20; niveau++) if (sortDebloque(sort, niveau, progression)) return niveau;
  return null;
}

/**
 * Caracteristique d'incantation : celle ecrite dans classes.json, sinon la
 * premiere caracteristique principale "mentale" de la classe, sinon l'Intelligence.
 */
export function caracteristiqueIncantation(classe) {
  if (classe?.caracteristiqueIncantation) return classe.caracteristiqueIncantation;
  return (classe?.caracteristiquesPrincipales ?? []).find((c) => ["intelligence", "sagesse", "charisme"].includes(c)) ?? "intelligence";
}

/**
 * Comment un sort se resout :
 *  - "attaque"     : jet d'attaque de sort (d20 + carac. + maitrise) contre la CA ;
 *  - "sauvegarde"  : la cible fait un jet de sauvegarde contre le DD du lanceur ;
 *  - "automatique" : il touche toujours (projectile magique), ou il soigne.
 * Ecrit dans le compendium (champ "resolution") ; sinon : degats -> attaque, soins -> automatique.
 */
export function resolutionDuSort(sort) {
  if (sort.resolution) return sort.resolution;
  return sort.degats ? "attaque" : "automatique";
}

/**
 * Les chiffres magiques d'un personnage, affiches en tete du grimoire :
 * bonus d'attaque de sort (Maitrise + carac.) et DD des sauvegardes (8 + ce bonus).
 */
export function statistiquesIncantation(fiche, classe) {
  const caracteristique = caracteristiqueIncantation(classe);
  const attaque = bonusDeMaitrise(fiche.niveau) + modificateur(fiche.caracteristiques[caracteristique] ?? 10);
  return { caracteristique, attaque, dd: 8 + attaque };
}
