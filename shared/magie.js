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

// --- Emplacements de sorts (D&D 5e) ---------------------------------------------------
// Table du Manuel des joueurs pour un lanceur "complet" (Mage, Pretre...) : pour
// chaque niveau de personnage (1 a 20), le nombre d'emplacements des sorts de
// niveau 1, 2, 3... Un demi-lanceur (Paladin, Chasseur) suit la meme table a la
// moitie de son niveau (arrondie au-dessus), a partir du niveau 2.
const TABLE_EMPLACEMENTS = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** La ressource qui compte les emplacements d'un niveau : "emplacements-niveau-3". */
export const cleEmplacement = (niveau) => `emplacements-niveau-${niveau}`;
const EST_EMPLACEMENT = /^emplacements-niveau-[1-9]$/;

/** Les emplacements que donne la table D&D a ce niveau de personnage : [niv. 1, niv. 2...]. */
export function emplacementsDeLaTable(niveau, progression = "complete") {
  const effectif = progression === "demi" ? (niveau < 2 ? 0 : Math.ceil(niveau / 2)) : niveau;
  return TABLE_EMPLACEMENTS[Math.max(0, Math.min(20, effectif))] ?? [];
}

/**
 * Les emplacements de sorts d'un personnage, niveau par niveau :
 * [{ niveau, max, actuel }]. Ne concerne que les LANCEURS de sorts : ceux dont
 * la classe (classes.json) donne une ressource "emplacements-niveau-N", ou qui
 * en ont deja une sur leur fiche. "classe" : l'entree du referentiel (ou null).
 *  - un niveau ou le personnage a deja sa ressource : on la lit (le MJ peut
 *    l'avoir ajustee, ex. l'Occultiste) ;
 *  - un autre niveau : le maximum de la table, tous les emplacements "allumes"
 *    (la ressource sera creee au premier emplacement depense).
 */
export function emplacementsDuPersonnage(fiche, classe = null) {
  const ressources = (fiche.ressources ?? []).filter((r) => EST_EMPLACEMENT.test(r.cle));
  const lanceur = ressources.length > 0 || (classe?.ressources ?? []).some((r) => EST_EMPLACEMENT.test(r.ressource ?? ""));
  if (!lanceur) return [];
  const table = emplacementsDeLaTable(fiche.niveau, classe?.progressionSorts ?? "complete");
  const liste = [];
  for (let niveau = 1; niveau <= 9; niveau++) {
    const ressource = ressources.find((r) => r.cle === cleEmplacement(niveau));
    const max = ressource ? ressource.max : (table[niveau - 1] ?? 0);
    if (max > 0) liste.push({ niveau, max, actuel: ressource ? ressource.actuel : max });
  }
  return liste;
}

/**
 * La formule d'un sort lance a un niveau superieur ("upcast") : "parNiveau"
 * (ex. "1d6") est ajoute pour chaque niveau au-dessus de celui du sort.
 * "8d6" + "1d6" x 2 -> "8d6+2d6".
 */
export function formuleAuNiveau(formule, parNiveau, niveauxEnPlus) {
  if (!parNiveau || niveauxEnPlus <= 0) return formule;
  const simple = parNiveau.replace(/\s+/g, "").match(/^(\d*)d(\d+)$/i);
  const ajout = simple ? `${(Number(simple[1]) || 1) * niveauxEnPlus}d${simple[2]}` : Array(niveauxEnPlus).fill(parNiveau).join("+");
  return `${formule}+${ajout}`;
}
