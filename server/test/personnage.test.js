import assert from "node:assert/strict";
import { test } from "node:test";
import { calculerPvMax, fabriquerPersonnage } from "../src/modeles/personnage.js";

const caracs = { force: 16, dexterite: 14, constitution: 14, intelligence: 10, sagesse: 12, charisme: 8 };
const contexte = { idTable: "t-0123456789", proprietaire: "Hadrien" };

test("PV max au niveau 1 = de de vie complet + mod. CON", () => {
  assert.equal(calculerPvMax("guerrier", 1, 14), 12); // d10 + 2
  assert.equal(calculerPvMax("magicien", 1, 8), 5); // d6 - 1
});

test("PV max aux niveaux suivants : valeur fixe du Manuel des joueurs", () => {
  assert.equal(calculerPvMax("guerrier", 5, 14), 12 + 4 * (6 + 2)); // 44
});

test("un personnage cree est complet et coherent", () => {
  const p = fabriquerPersonnage({ nom: "Jaina", classe: "magicien", caracteristiques: caracs }, contexte);
  assert.equal(p.pointsDeVie.max, 8);
  assert.equal(p.pointsDeVie.actuels, 8);
  assert.equal(p.classeArmure, 12);
  assert.equal(p.desDeVie.faces, 6);
  assert.equal(p.ressources[0].cle, "emplacements-niveau-1");
  assert.match(p.id, /^p-[0-9a-f]{10}$/);
});

test("Defense sans armure du Barbare et du Moine", () => {
  const barbare = fabriquerPersonnage({ nom: "Garrosh", classe: "barbare", caracteristiques: caracs }, contexte);
  const moine = fabriquerPersonnage({ nom: "Chen", classe: "moine", caracteristiques: caracs }, contexte);
  assert.equal(barbare.classeArmure, 10 + 2 + 2);
  assert.equal(moine.classeArmure, 10 + 2 + 1);
});

test("un navigateur ne peut pas imposer ses propres PV ou champs inconnus", () => {
  assert.throws(() =>
    fabriquerPersonnage(
      { nom: "Triche", classe: "guerrier", caracteristiques: caracs, pointsDeVie: { max: 999, actuels: 999, temporaires: 0 } },
      contexte,
    ),
  );
});

test("caracteristiques hors limites refusees", () => {
  assert.throws(() =>
    fabriquerPersonnage({ nom: "Titan", classe: "guerrier", caracteristiques: { ...caracs, force: 45 } }, contexte),
  );
});
