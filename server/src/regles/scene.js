// Regles de la scene : placer et deplacer les pions, regler la grille,
// peindre le brouillard, et decider ce que les joueurs ont le droit de voir.
import { couleurPour } from "../../../shared/couleurs.js";
import { aimanter, borner, estRevele, traitCouvre } from "../../../shared/geometrie.js";
import { nouvelId } from "../modeles/identifiants.js";
import { LIMITES_BROUILLARD } from "../modeles/scene.js";
import { ErreurRegle } from "./erreurs.js";

// La couleur d'un pion est celle de son joueur (voir shared/couleurs.js).
export { couleurPour };

/** Position finale d'un pion : dans la carte, et aimantee a la grille si demande. */
export function positionValide(scene, x, y, { aimanter: avecAimant = true, taille = 1 } = {}) {
  const dansLaCarte = borner(x, y, scene.carte);
  if (!avecAimant) return dansLaCarte;
  const surLaGrille = aimanter(dansLaCarte.x, dansLaCarte.y, scene.grille, taille);
  return borner(surLaGrille.x, surLaGrille.y, scene.carte);
}

/**
 * Pose le pion d'un personnage. Un monstre / PNJ arrive CACHE aux joueurs
 * (le MJ le revele quand il veut : clic droit > "Reveler") ; un heros, visible.
 * "cache" permet de choisir explicitement.
 */
export function placerPion(scene, personnage, position, { cache = personnage.proprietaire === null, taille = 1 } = {}) {
  if (scene.pions.some((p) => p.idPersonnage === personnage.id)) {
    throw new ErreurRegle(`${personnage.nom} est deja sur la carte.`);
  }
  // Sans position precise : au centre de la carte.
  const { x, y } = positionValide(scene, position?.x ?? scene.carte.largeur / 2, position?.y ?? scene.carte.hauteur / 2, { taille });
  const pion = {
    id: nouvelId("j"),
    idPersonnage: personnage.id,
    x,
    y,
    taille, // en cases : 2 = un ogre (2 x 2), 4 = un dragon
    couleur: couleurPour(personnage.proprietaire),
    cache,
  };
  return { scene: { ...scene, pions: [...scene.pions, pion] }, pion };
}

/**
 * Case libre la plus proche d'un point : on tourne en carres de plus en plus
 * grands autour de lui, jusqu'a trouver une case sans pion dans la carte.
 */
export function caseLibreProche(scene, depart) {
  const pas = scene.grille.taille;
  const centre = positionValide(scene, depart.x, depart.y);
  const occupee = (x, y) => scene.pions.some((p) => Math.hypot(p.x - x, p.y - y) < pas / 2);
  for (let anneau = 0; anneau <= 30; anneau++) {
    for (let dy = -anneau; dy <= anneau; dy++) {
      for (let dx = -anneau; dx <= anneau; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== anneau) continue; // seulement le bord du carre
        const x = centre.x + dx * pas;
        const y = centre.y + dy * pas;
        if (x < 0 || y < 0 || x > scene.carte.largeur || y > scene.carte.hauteur) continue;
        if (!occupee(x, y)) return { x, y };
      }
    }
  }
  return centre;
}

export function deplacerPion(scene, idPion, x, y, options) {
  const pion = scene.pions.find((p) => p.id === idPion);
  if (!pion) throw new ErreurRegle("Ce pion n'est plus sur la carte.");
  const position = positionValide(scene, x, y, { ...options, taille: pion.taille });
  const deplace = { ...pion, ...position };
  return { scene: { ...scene, pions: scene.pions.map((p) => (p.id === idPion ? deplace : p)) }, pion: deplace };
}

/** Taille d'un pion (1 a 4 cases de cote) : il se recale sur la grille. */
export function changerTaillePion(scene, idPion, taille) {
  const pion = scene.pions.find((p) => p.id === idPion);
  if (!pion) throw new ErreurRegle("Ce pion n'est plus sur la carte.");
  const position = positionValide(scene, pion.x, pion.y, { taille });
  return { ...scene, pions: scene.pions.map((p) => (p.id === idPion ? { ...p, ...position, taille } : p)) };
}

export function retirerPion(scene, idPion) {
  if (!scene.pions.some((p) => p.id === idPion)) throw new ErreurRegle("Ce pion n'est plus sur la carte.");
  return { ...scene, pions: scene.pions.filter((p) => p.id !== idPion) };
}

/** Nouvelle carte : la grille est conservee, le brouillard repart a zero (tout noir). */
export function changerCarte(scene, carte) {
  const pions = scene.pions.map((p) => ({ ...p, ...borner(p.x, p.y, carte) }));
  return { ...scene, carte, pions, brouillard: { actif: scene.brouillard.actif, traits: [] } };
}

export function ajouterTrait(scene, trait) {
  if (scene.brouillard.traits.length >= LIMITES_BROUILLARD.traits) {
    throw new ErreurRegle("Brouillard trop detaille : utilise 'Tout cacher' ou 'Tout reveler' pour repartir de zero.");
  }
  return { ...scene, brouillard: { ...scene.brouillard, traits: [...scene.brouillard.traits, trait] } };
}

export function toutReveler(scene) {
  return { ...scene, brouillard: { ...scene.brouillard, traits: [{ mode: "tout-reveler" }] } };
}

export function toutCacher(scene) {
  return { ...scene, brouillard: { ...scene.brouillard, traits: [] } };
}

/**
 * Un pion est-il visible par les joueurs ?
 *  - un pion cache par le MJ : non ;
 *  - le pion d'un joueur : oui, toujours (on sait ou sont ses compagnons) ;
 *  - un PNJ / monstre : seulement s'il se trouve dans une zone revelee.
 */
export function pionVisibleParLesJoueurs(scene, pion, personnage) {
  if (pion.cache || !personnage) return false;
  if (personnage.proprietaire !== null) return true;
  return estRevele(scene.brouillard, pion.x, pion.y);
}

/** Le trait touche-t-il un pion de PNJ ? (sa visibilite pour les joueurs peut alors changer) */
export function traitTouchePnj(scene, trait, personnageDe) {
  if (trait.mode === "tout-reveler") return true;
  return scene.pions.some((p) => personnageDe(p.idPersonnage)?.proprietaire === null && traitCouvre(trait, p.x, p.y));
}
