import assert from "node:assert/strict";
import { test } from "node:test";
import { attaquesEquipees, classeArmureEquipee, peutAllerDans, typeEmplacement } from "../../shared/equipement.js";
import { creerCompendium, instancierObjet } from "../src/donnees/compendium.js";
import { fabriquerPersonnage } from "../src/modeles/personnage.js";
import { aPortee, creerButin, prendreDansButin } from "../src/regles/butins.js";
import { desequiper, equiper, recalculerClasseArmure } from "../src/regles/equipement.js";
import { ErreurRegle } from "../src/regles/erreurs.js";
import { ajouterAuSac, sortirUn } from "../src/regles/inventaire.js";
import { sceneVide } from "../src/modeles/scene.js";
import { referentielExemple } from "./aides.js";

const referentiel = referentielExemple();
const compendium = creerCompendium("exemples/compendium");
compendium.charger();
const exemplaire = (id, quantite = 1) => instancierObjet(compendium.obtenirObjet(id), quantite);

// Un guerrier (FOR 16, DEX 14) avec quelques objets dans son sac.
function guerrier(...ids) {
  const p = fabriquerPersonnage(
    { nom: "Varian", classe: "guerrier", caracteristiques: { force: 16, dexterite: 14, constitution: 14, intelligence: 10, sagesse: 10, charisme: 10 } },
    { idTable: "t-0123456789", proprietaire: "A", referentiel },
  );
  return { ...p, inventaire: ids.map((id) => exemplaire(id)) };
}
const objet = (fiche, nom) => fiche.inventaire.find((o) => o.nom === nom);
const refus = (fonction, motif) => assert.throws(fonction, (e) => e instanceof ErreurRegle && motif.test(e.message));

// --- Ou va chaque objet ? -----------------------------------------------------------------

test("emplacement deduit du type, ou ecrit dans le compendium", () => {
  const types = ["epee-longue", "lame-des-cendres", "bouclier-de-hurlevent", "armure-de-cuir", "cape-du-veilleur", "arc-long", "potion-de-soins"].map((id) =>
    typeEmplacement(compendium.obtenirObjet(id)),
  );
  assert.deepEqual(types, ["une-main", "deux-mains", "main-gauche", "torse", "dos", "distance", null]);
  // Sans champ "emplacement", une armure de moins de 10 est un accessoire (dos).
  assert.equal(typeEmplacement({ type: "armure", armure: { classeArmure: 1, categorie: "legere" } }), "dos");
  assert.ok(peutAllerDans(compendium.obtenirObjet("epee-longue"), "main-gauche"));
  assert.ok(!peutAllerDans(compendium.obtenirObjet("lame-des-cendres"), "main-gauche"));
  assert.ok(!peutAllerDans(compendium.obtenirObjet("armure-de-cuir"), "tete"));
});

// --- Equiper / desequiper -------------------------------------------------------------------

test("equiper : du sac vers l'emplacement ; une deuxieme arme a une main va dans l'autre main", () => {
  let fiche = guerrier("epee-longue", "epee-longue");
  fiche = equiper(fiche, fiche.inventaire[0].id).fiche;
  fiche = equiper(fiche, fiche.inventaire[0].id).fiche;
  assert.deepEqual(Object.keys(fiche.equipement).sort(), ["main-droite", "main-gauche"]);
  assert.equal(fiche.inventaire.length, 0);
});

test("une arme a deux mains libere la main gauche ; un bouclier repousse l'arme a deux mains", () => {
  let fiche = guerrier("epee-longue", "bouclier-de-hurlevent", "lame-des-cendres");
  fiche = equiper(fiche, objet(fiche, "Epee longue").id).fiche;
  fiche = equiper(fiche, objet(fiche, "Bouclier de Hurlevent").id).fiche;
  const lame = equiper(fiche, objet(fiche, "Lame des Cendres").id);
  assert.deepEqual(lame.detail.ranges.sort(), ["Bouclier de Hurlevent", "Epee longue"]);
  assert.deepEqual(Object.keys(lame.fiche.equipement), ["main-droite"]);

  const bouclier = equiper(lame.fiche, objet(lame.fiche, "Bouclier de Hurlevent").id);
  assert.deepEqual(bouclier.detail.ranges, ["Lame des Cendres"]);
  assert.equal(bouclier.fiche.equipement["main-gauche"].nom, "Bouclier de Hurlevent");
});

test("equiper : refus clairs (mauvais emplacement, objet non equipable, objet absent)", () => {
  const fiche = guerrier("armure-de-cuir", "potion-de-soins");
  refus(() => equiper(fiche, objet(fiche, "Armure de cuir").id, "tete"), /ne se porte pas a cet emplacement \(Tete\)/);
  refus(() => equiper(fiche, objet(fiche, "Potion de soins").id), /ne s'equipe pas/);
  refus(() => equiper(fiche, "o-0000000000"), /n'est plus dans le sac/);
});

test("desequiper : retour au sac ; un emplacement vide est refuse", () => {
  let fiche = guerrier("epee-longue");
  fiche = equiper(fiche, fiche.inventaire[0].id).fiche;
  fiche = desequiper(fiche, "main-droite").fiche;
  assert.deepEqual([fiche.equipement, fiche.inventaire.map((o) => o.nom)], [{}, ["Epee longue"]]);
  refus(() => desequiper(fiche, "tete"), /deja vide/);
});

// --- Statistiques recalculees -----------------------------------------------------------------

test("classe d'armure D&D 5e : armures legere / lourde, bouclier, accessoire", () => {
  const classe = referentiel.obtenirClasse("guerrier");
  const ca = (...ids) => {
    let fiche = guerrier(...ids);
    for (const id of ids) fiche = equiper(fiche, fiche.inventaire.find((o) => o.source === id).id).fiche;
    return recalculerClasseArmure(fiche, classe).classeArmure;
  };
  assert.equal(ca(), 12); // 10 + DEX 2
  assert.equal(ca("armure-de-cuir"), 13); // 11 + DEX 2
  assert.equal(ca("cotte-de-mailles"), 16); // lourde : sans la DEX
  assert.equal(ca("cotte-de-mailles", "bouclier-de-hurlevent"), 18); // + bouclier 2
  assert.equal(ca("armure-de-cuir", "bouclier-de-hurlevent", "cape-du-veilleur"), 16); // 13 + 2 + 1
  // Armure intermediaire : DEX plafonnee a 2 par defaut.
  assert.equal(classeArmureEquipee({ torse: { armure: { classeArmure: 14, categorie: "intermediaire" } } }, { dexterite: 18 }, 14), 16);
});

test("defense sans armure du Moine, lue dans le referentiel", () => {
  const moine = { ...guerrier(), classe: "moine", caracteristiques: { force: 10, dexterite: 16, constitution: 12, intelligence: 10, sagesse: 16, charisme: 8 } };
  assert.equal(recalculerClasseArmure(moine, referentiel.obtenirClasse("moine")).classeArmure, 16); // 10 + 3 + 3
});

test("attaques des armes en main : maitrise + FOR, ou DEX a distance", () => {
  let fiche = guerrier("epee-longue", "arc-long");
  for (const o of [...fiche.inventaire]) fiche = equiper(fiche, o.id).fiche;
  const attaques = attaquesEquipees(fiche);
  assert.deepEqual(
    attaques.map((a) => [a.emplacement, a.bonus, a.degats]),
    [["main-droite", 5, "1d8+3"], ["distance", 4, "1d8+2"]],
  );
});

// --- Sac et butin -----------------------------------------------------------------------------

test("sac : les objets empilables rejoignent leur pile ; on n'en sort qu'un a la fois", () => {
  let sac = ajouterAuSac([], exemplaire("potion-de-soins", 2));
  sac = ajouterAuSac(sac, exemplaire("potion-de-soins", 3));
  assert.deepEqual(sac.map((o) => o.quantite), [5]);
  const { inventaire, exemplaire: sortie } = sortirUn(sac, sac[0].id);
  assert.deepEqual([inventaire[0].quantite, sortie.quantite], [4, 1]);
  assert.notEqual(sortie.id, sac[0].id);
});

test("butin : un objet ne peut etre pris qu'une fois", () => {
  const { scene, butin } = creerButin(sceneVide("t-0123456789"), { genre: "coffre", nom: "Coffre", x: 150, y: 150, objets: [exemplaire("epee-longue")] });
  const idObjet = butin.objets[0].id;
  const premier = prendreDansButin(scene, butin.id, idObjet);
  assert.equal(premier.objet.nom, "Epee longue");
  assert.equal(premier.butin.objets.length, 0);
  refus(() => prendreDansButin(premier.scene, butin.id, idObjet), /deja pris/);
});

test("butin : il faut que son pion soit a 2 cases au plus", () => {
  const { scene, butin } = creerButin(sceneVide("t-0123456789"), { genre: "coffre", nom: "Coffre", x: 150, y: 150 });
  const avec = (x, y) => ({ ...scene, pions: [{ id: "j-0000000001", idPersonnage: "p-0000000001", x, y, taille: 1, couleur: "#ffffff", cache: false }] });
  assert.ok(aPortee(avec(350, 150), butin, "p-0000000001")); // 2 cases
  assert.ok(!aPortee(avec(450, 150), butin, "p-0000000001")); // 3 cases
  assert.ok(!aPortee(scene, butin, "p-0000000001")); // pas de pion sur la carte
});
