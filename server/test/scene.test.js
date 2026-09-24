import assert from "node:assert/strict";
import { test } from "node:test";
import { aimanter, caseDe, distanceEnCases, estRevele } from "../../shared/geometrie.js";
import { sceneVide } from "../src/modeles/scene.js";
import { ErreurRegle } from "../src/regles/erreurs.js";
import {
  ajouterTrait,
  changerCarte,
  couleurPour,
  deplacerPion,
  pionVisibleParLesJoueurs,
  placerPion,
  toutCacher,
  toutReveler,
  traitTouchePnj,
} from "../src/regles/scene.js";

const grille = { taille: 100, decalageX: 30, decalageY: 55, visible: true };

test("aimanter : centre de case (pion 1x1), intersection (pion 2x2)", () => {
  assert.deepEqual(aimanter(170, 190, grille), { x: 180, y: 205 }); // case (1,1) : de 130 a 230
  assert.deepEqual(aimanter(170, 190, grille, 2), { x: 130, y: 155 });
});

test("distance D&D 5e : une diagonale compte pour une case", () => {
  assert.equal(distanceEnCases({ x: 80, y: 105 }, { x: 380, y: 305 }, grille), 3);
  assert.deepEqual(caseDe(29, 54, grille), { colonne: -1, ligne: -1 });
});

const brouillard = (traits, actif = true) => ({ actif, traits });
const gomme = (points, rayon = 50) => ({ mode: "reveler", rayon, points });
const pinceau = (points, rayon = 50) => ({ mode: "cacher", rayon, points });

test("brouillard : tout est noir au depart, la gomme revele, le pinceau recouvre", () => {
  assert.equal(estRevele(brouillard([]), 100, 100), false);
  assert.equal(estRevele(brouillard([gomme([[0, 100], [400, 100]])]), 200, 130), true); // le long du trait
  assert.equal(estRevele(brouillard([gomme([[0, 100], [400, 100]])]), 200, 200), false); // trop loin
  // Le plus recent l'emporte : on revele, puis on recouvre une partie.
  const b = brouillard([gomme([[0, 100], [400, 100]]), pinceau([[200, 100]])]);
  assert.equal(estRevele(b, 200, 100), false);
  assert.equal(estRevele(b, 350, 100), true);
  assert.equal(estRevele(brouillard([{ mode: "tout-reveler" }]), 5, 5), true);
  assert.equal(estRevele(brouillard([], false), 5, 5), true); // brouillard desactive
});

const joueur = { id: "p-0000000001", nom: "Thrall", proprietaire: "Hadrien" };
const monstre = { id: "p-0000000002", nom: "Gobelin", proprietaire: null };

test("placer : au centre, aimante ; pas deux fois le meme personnage ; couleur par joueur", () => {
  const { scene, pion } = placerPion(sceneVide("t-0123456789"), joueur);
  // Centre de la carte (1000 px) pile sur une ligne : il rejoint la case suivante.
  assert.deepEqual([pion.x, pion.y], [1050, 1050]);
  assert.throws(() => placerPion(scene, joueur), ErreurRegle);
  assert.equal(pion.couleur, couleurPour("hadrien")); // meme couleur, majuscules ou non
  assert.equal(placerPion(scene, monstre).pion.couleur, "#b22222");
});

test("deplacer : la position officielle reste dans la carte et s'aimante", () => {
  let { scene, pion } = placerPion(sceneVide("t-0123456789"), joueur);
  let r = deplacerPion(scene, pion.id, 5000, -300, { aimanter: false });
  assert.deepEqual([r.pion.x, r.pion.y], [2000, 0]);
  r = deplacerPion(scene, pion.id, 1234, 567, { aimanter: true });
  assert.deepEqual([r.pion.x, r.pion.y], [1250, 550]);
  assert.throws(() => deplacerPion(scene, "j-9999999999", 0, 0), ErreurRegle);
});

test("visibilite joueurs : compagnons toujours visibles, monstres seulement hors du brouillard", () => {
  let scene = placerPion(sceneVide("t-0123456789"), joueur).scene;
  const place = placerPion(scene, monstre);
  scene = place.scene;
  const pionMonstre = place.pion;
  const [pionJoueur] = scene.pions;
  assert.equal(pionVisibleParLesJoueurs(scene, pionJoueur, joueur), true);
  assert.equal(pionVisibleParLesJoueurs(scene, pionMonstre, monstre), false); // dans le noir

  const trait = gomme([[pionMonstre.x, pionMonstre.y]], 80);
  assert.equal(traitTouchePnj(scene, trait, (id) => (id === monstre.id ? monstre : joueur)), true);
  scene = ajouterTrait(scene, trait);
  assert.equal(pionVisibleParLesJoueurs(scene, pionMonstre, monstre), true); // revele
  assert.equal(pionVisibleParLesJoueurs(scene, { ...pionMonstre, cache: true }, monstre), false); // cache par le MJ
  assert.equal(pionVisibleParLesJoueurs(toutCacher(scene), pionMonstre, monstre), false);
  assert.equal(pionVisibleParLesJoueurs(toutReveler(scene), pionMonstre, monstre), true);
});

test("changer de carte : brouillard remis a zero, pions ramenes dans la nouvelle carte", () => {
  let { scene } = placerPion(sceneVide("t-0123456789"), joueur);
  scene = deplacerPion(ajouterTrait(scene, gomme([[0, 0]])), scene.pions[0].id, 1900, 1900, { aimanter: false }).scene;
  const nouvelle = changerCarte(scene, { fichier: "crypte.jpg", largeur: 1000, hauteur: 800 });
  assert.deepEqual(nouvelle.brouillard.traits, []);
  assert.deepEqual([nouvelle.pions[0].x, nouvelle.pions[0].y], [1000, 800]);
  assert.deepEqual(nouvelle.grille, scene.grille); // la grille est conservee
});
