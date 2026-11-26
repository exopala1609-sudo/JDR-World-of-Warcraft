// Tirage des caracteristiques aux des, methode du Manuel des joueurs :
// six fois 4d6, on garde les 3 meilleurs des. C'est le SERVEUR qui lance.
//
// Le tirage de chaque joueur est garde par la table (table.tirages) : recharger
// la page ne permet pas de relancer. Chaque joueur a 2 relances offertes ; le
// MJ peut en accorder d'autres. Le joueur garde toujours son MEILLEUR tirage
// (le total le plus haut).
import { lancerDes } from "./des.js";
import { ErreurRegle } from "./erreurs.js";

export const FORMULE_TIRAGE = "4d6kh3";
export const RELANCES_OFFERTES = 2;
const TIRAGES_MAX = 20; // garde-fou : un joueur ne relance pas indefiniment

export const totalTirage = (valeurs) => valeurs.reduce((total, v) => total + v, 0);

/**
 * Six scores : { valeurs: [15, 12...], des: [[6, 5, 4, 1], ...] }.
 * "lancer" est remplacable dans les tests (des truques).
 */
export function tirerCaracteristiques(lancer = lancerDes) {
  const lancers = Array.from({ length: 6 }, () => lancer(FORMULE_TIRAGE));
  return { valeurs: lancers.map((l) => l.total), des: lancers.map((l) => l.termes[0].jets) };
}

/**
 * Enregistre un nouveau tirage dans l'entree du joueur (null s'il n'a jamais tire).
 * Renvoie la nouvelle entree et ce qui est garde ("nouveau" ou "ancien").
 */
export function appliquerTirage(entree, valeurs, pseudo) {
  if (!entree) {
    return { entree: { pseudo, tirages: [valeurs], retenu: 0, relancesRestantes: RELANCES_OFFERTES }, garde: "nouveau" };
  }
  if (entree.relancesRestantes < 1) throw new ErreurRegle("Tu n'as plus de relance. Pour relancer encore, demande au MJ.");
  if (entree.tirages.length >= TIRAGES_MAX) throw new ErreurRegle("Trop de relances pour ce personnage.");
  const tirages = [...entree.tirages, valeurs];
  // Le meilleur tirage : celui qui a le total le plus haut (a egalite, on garde l'ancien).
  const meilleur = totalTirage(valeurs) > totalTirage(entree.tirages[entree.retenu]);
  return {
    entree: { ...entree, tirages, retenu: meilleur ? tirages.length - 1 : entree.retenu, relancesRestantes: entree.relancesRestantes - 1 },
    garde: meilleur ? "nouveau" : "ancien",
  };
}

/** Le MJ accorde une relance de plus. */
export function autoriserRelance(entree) {
  if (!entree) throw new ErreurRegle("Ce joueur n'a pas encore tire ses caracteristiques.");
  if (entree.tirages.length + entree.relancesRestantes >= TIRAGES_MAX) throw new ErreurRegle("Trop de relances pour ce personnage.");
  return { ...entree, relancesRestantes: entree.relancesRestantes + 1 };
}

/** Les valeurs gardees d'une entree (ou null). */
export const valeursRetenues = (entree) => (entree ? entree.tirages[entree.retenu] : null);
