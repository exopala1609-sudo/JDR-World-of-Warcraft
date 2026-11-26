// Le butin : coffres et cadavres poses sur la carte, qu'on peut fouiller.
// Fonctions PURES sur la scene.
import { distanceEnCases, estRevele } from "../../../shared/geometrie.js";
import { nouvelId } from "../modeles/identifiants.js";
import { ErreurRegle } from "./erreurs.js";

export const PORTEE_DE_FOUILLE = 2; // en cases : il faut etre a cote du coffre

/** Un butin est-il visible des joueurs ? (pas cache par le MJ, et hors du brouillard) */
export const butinVisibleParLesJoueurs = (scene, butin) => !butin.cache && estRevele(scene.brouillard, butin.x, butin.y);

export function creerButin(scene, { genre, nom, x, y, objets = [] }) {
  const butin = { id: nouvelId("b"), genre, nom, x, y, objets, cache: false };
  return { scene: { ...scene, butins: [...scene.butins, butin] }, butin };
}

export function exigerButin(scene, idButin) {
  const butin = scene.butins.find((b) => b.id === idButin);
  if (!butin) throw new ErreurRegle("Ce butin n'existe plus.");
  return butin;
}

/** Le pion de ce personnage est-il assez pres du butin pour le fouiller ? */
export function aPortee(scene, butin, idPersonnage) {
  const pion = scene.pions.find((p) => p.idPersonnage === idPersonnage);
  return Boolean(pion) && distanceEnCases(pion, butin, scene.grille) <= PORTEE_DE_FOUILLE;
}

/**
 * Retire un objet du butin (la pile entiere). Le serveur traite les demandes
 * une par une : si deux joueurs cliquent en meme temps, le second trouve la
 * place vide et recoit un refus. Aucun objet ne peut etre pille deux fois.
 */
export function prendreDansButin(scene, idButin, idObjet) {
  const butin = exigerButin(scene, idButin);
  const objet = butin.objets.find((o) => o.id === idObjet);
  if (!objet) throw new ErreurRegle("Quelqu'un a deja pris cet objet.");
  const reste = { ...butin, objets: butin.objets.filter((o) => o.id !== idObjet) };
  return { scene: { ...scene, butins: scene.butins.map((b) => (b.id === idButin ? reste : b)) }, butin: reste, objet };
}
