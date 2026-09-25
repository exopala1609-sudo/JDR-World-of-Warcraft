import assert from "node:assert/strict";
import { test } from "node:test";
import { fabriquerPersonnage } from "../src/modeles/personnage.js";
import { ErreurRegle } from "../src/regles/erreurs.js";
import { reposCourt, reposLong } from "../src/regles/repos.js";
import { appliquerRegleRepos, modifierRessource } from "../src/regles/ressources.js";
import { referentielExemple } from "./aides.js";

const jauge = (actuel, reposCourt, reposLong, max = 100) => ({
  cle: "test", nom: "Test", type: "jauge", actuel, max, reposCourt, reposLong, apparence: "test",
});
// Un "faux de" qui renvoie toujours la meme valeur : les tests sont reproductibles.
const deTruque = (valeur) => () => ({ total: valeur });

test("regles de repos d'une ressource : remplir, vider, moitie, ajouter, aucun", () => {
  assert.equal(appliquerRegleRepos(jauge(10, "remplir"), "remplir").actuel, 100);
  assert.equal(appliquerRegleRepos(jauge(60, "vider"), "vider").actuel, 0);
  assert.equal(appliquerRegleRepos(jauge(10, "moitie"), "moitie").actuel, 60);
  assert.equal(appliquerRegleRepos(jauge(90, "moitie"), "moitie").actuel, 100); // plafonne
  assert.equal(appliquerRegleRepos(jauge(1, null), { ajouter: 2 }).actuel, 3);
  assert.equal(appliquerRegleRepos(jauge(7, "aucun"), "aucun").actuel, 7);
});

test("on ne depense pas ce qu'on n'a pas, et un gain est plafonne", () => {
  assert.equal(modifierRessource(jauge(30), -10).actuel, 20);
  assert.throws(() => modifierRessource(jauge(5), -10), ErreurRegle);
  assert.equal(modifierRessource(jauge(95), 20).actuel, 100);
});

const caracs = { force: 10, dexterite: 10, constitution: 14, intelligence: 10, sagesse: 10, charisme: 10 };
function guerrierBlesse() {
  const p = fabriquerPersonnage(
    { nom: "Varian", classe: "guerrier", niveau: 4, caracteristiques: caracs },
    { idTable: "t-0123456789", proprietaire: "A", referentiel: referentielExemple() },
  );
  return {
    ...p,
    pointsDeVie: { ...p.pointsDeVie, actuels: 5, temporaires: 3 },
    desDeVie: { faces: 10, restants: 3 },
    ressources: [
      jauge(20, "moitie", "remplir"), // facon Mana
      { ...jauge(80, "vider", "vider"), cle: "rage", nom: "Rage" }, // facon Rage WoW
      { ...jauge(0, "aucun", "remplir", 5), cle: "eclats", nom: "Eclats d'ame", type: "compteur" },
    ],
  };
}

test("repos court : des de vie + CON, puis les regles de chaque ressource", () => {
  const { personnage, detail } = reposCourt(guerrierBlesse(), 2, deTruque(6));
  assert.equal(detail.pvRecuperes, 2 * (6 + 2)); // 2 des x (6 + mod CON 2)
  assert.equal(personnage.pointsDeVie.actuels, 21);
  assert.equal(personnage.pointsDeVie.temporaires, 3); // un repos court ne les retire pas
  assert.equal(personnage.desDeVie.restants, 1);
  assert.deepEqual(personnage.ressources.map((r) => r.actuel), [70, 0, 0]);
});

test("repos court : on ne peut pas depenser plus de des qu'il n'en reste", () => {
  assert.throws(() => reposCourt(guerrierBlesse(), 4), ErreurRegle);
});

test("repos long : PV max, PV temporaires perdus, moitie des des de vie, ressources", () => {
  const { personnage, detail } = reposLong({ ...guerrierBlesse(), desDeVie: { faces: 10, restants: 0 } });
  assert.equal(personnage.pointsDeVie.actuels, personnage.pointsDeVie.max);
  assert.equal(personnage.pointsDeVie.temporaires, 0);
  assert.equal(personnage.desDeVie.restants, 2); // niveau 4 -> recupere 2
  assert.equal(detail.desDeVieRecuperes, 2);
  assert.deepEqual(personnage.ressources.map((r) => r.actuel), [100, 0, 5]);
});

test("repos long : au moins 1 de de vie recupere, jamais plus que le niveau", () => {
  const niveau1 = { ...guerrierBlesse(), niveau: 1, desDeVie: { faces: 10, restants: 0 } };
  assert.equal(reposLong(niveau1).personnage.desDeVie.restants, 1);
  const plein = { ...guerrierBlesse(), desDeVie: { faces: 10, restants: 4 } };
  assert.equal(reposLong(plein).personnage.desDeVie.restants, 4);
});
