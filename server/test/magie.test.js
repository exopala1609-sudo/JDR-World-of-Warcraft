import assert from "node:assert/strict";
import { test } from "node:test";
import { attaquesEquipees } from "../../shared/equipement.js";
import { caracteristiqueIncantation, niveauDeSortMax, niveauRequis, resolutionDuSort, sortDebloque, statistiquesIncantation } from "../../shared/magie.js";
import { doublerDes, jetArme, jetSort } from "../src/regles/resolution.js";
import { referentielExemple } from "./aides.js";

const referentiel = referentielExemple();

/** Un "faux de" : chaque formule renvoie la valeur demandee (d20 -> 14, le reste -> 5). */
function desTruques(d20 = 14, autres = 5) {
  return (formule) => {
    const valeur = formule === "1d20" ? d20 : autres;
    return { total: valeur, termes: [{ type: "des", jets: [valeur], gardes: [0] }] };
  };
}

const mage = {
  niveau: 3,
  caracteristiques: { force: 8, dexterite: 14, constitution: 12, intelligence: 16, sagesse: 10, charisme: 10 },
  equipement: {},
};

test("niveaux de sorts accessibles : lanceurs complets et demi-lanceurs (D&D 5e)", () => {
  assert.deepEqual([1, 2, 3, 5, 9, 17, 20].map((n) => niveauDeSortMax(n)), [1, 1, 2, 3, 5, 9, 9]);
  assert.deepEqual([1, 2, 5, 9, 13, 17].map((n) => niveauDeSortMax(n, "demi")), [0, 1, 2, 3, 4, 5]);
  assert.ok(sortDebloque({ niveau: 0 }, 1, "demi")); // les sorts mineurs, toujours
  assert.ok(!sortDebloque({ niveau: 3 }, 3));
  assert.equal(niveauRequis({ niveau: 3 }), 5);
  assert.equal(niveauRequis({ niveau: 1 }, "demi"), 2);
});

test("caracteristique d'incantation lue dans classes.json (et deduite sinon)", () => {
  assert.equal(caracteristiqueIncantation(referentiel.obtenirClasse("magicien")), "intelligence");
  assert.equal(caracteristiqueIncantation(referentiel.obtenirClasse("clerc")), "sagesse");
  assert.equal(caracteristiqueIncantation(referentiel.obtenirClasse("occultiste")), "charisme");
  assert.equal(referentiel.obtenirClasse("paladin").progressionSorts, "demi");
  assert.equal(caracteristiqueIncantation({ caracteristiquesPrincipales: ["force", "sagesse"] }), "sagesse");
});

test("resolution d'un sort : ecrite dans le compendium, sinon deduite", () => {
  assert.equal(resolutionDuSort({ degats: { formule: "1d10" } }), "attaque");
  assert.equal(resolutionDuSort({ soins: "1d8" }), "automatique");
  assert.equal(resolutionDuSort({ degats: {}, resolution: "sauvegarde" }), "sauvegarde");
});

test("attaque de sort : De + Intelligence + Maitrise, puis degats", () => {
  const sort = { nom: "Trait de feu", niveau: 0, ecole: "evocation", degats: { formule: "1d10", type: "feu" } };
  const { lignes, action } = jetSort(mage, sort, referentiel.obtenirClasse("magicien"), desTruques(14, 7));
  assert.equal(action.detail, "Sort mineur - evocation");
  assert.deepEqual(lignes[0].modificateurs, [{ nom: "Intelligence", valeur: 3 }, { nom: "Maitrise", valeur: 2 }]);
  assert.deepEqual([lignes[0].d20, lignes[0].total], [14, 19]);
  assert.deepEqual([lignes[1].libelle, lignes[1].total], ["Degats (feu)", 7]);
});

test("sort a jet de sauvegarde : le DD est calcule (8 + maitrise + carac.)", () => {
  const sort = { nom: "Boule de feu", niveau: 3, ecole: "evocation", resolution: "sauvegarde", sauvegarde: "dexterite", degats: { formule: "8d6", type: "feu" } };
  const { lignes, note } = jetSort(mage, sort, referentiel.obtenirClasse("magicien"), desTruques());
  assert.equal(lignes.length, 1); // pas de d20 pour le lanceur : seulement les degats
  assert.match(note, /^DD 13 .*sauvegarde de Dexterite/);
});

test("soins : des + modificateur d'incantation", () => {
  const pretre = { ...mage, caracteristiques: { ...mage.caracteristiques, sagesse: 16 } };
  const { lignes } = jetSort(pretre, { nom: "Soins", niveau: 1, ecole: "evocation", soins: "1d8" }, referentiel.obtenirClasse("clerc"), desTruques(14, 6));
  assert.deepEqual([lignes[0].libelle, lignes[0].modificateurs, lignes[0].total], ["Soins", [{ nom: "Sagesse", valeur: 3 }], 9]);
});

test("arme : critique sur un 20 naturel (des de degats doubles), un 1 rate toujours", () => {
  assert.equal(doublerDes("1d8+3"), "2d8+3");
  assert.equal(doublerDes("2d6+1d6"), "4d6+2d6");
  const guerrier = { ...mage, caracteristiques: { ...mage.caracteristiques, force: 16 }, equipement: { "main-droite": { id: "o-1", nom: "Epee", arme: { degats: "1d8", typeDegats: "tranchant", proprietes: [] } } } };
  const attaque = attaquesEquipees(guerrier)[0];
  const formules = [];
  const lancer = (f) => (formules.push(f), desTruques(20, 6)(f));
  const crit = jetArme(guerrier, attaque, guerrier.equipement["main-droite"], lancer);
  assert.deepEqual(formules, ["1d20", "2d8"]);
  assert.deepEqual(crit.lignes.map((l) => l.total), [25, 9]); // 20 + 3 + 2 ; 6 + 3
  assert.match(crit.note, /critique/);
  const rate = jetArme(guerrier, attaque, guerrier.equipement["main-droite"], desTruques(1));
  assert.equal(rate.lignes.length, 1);
});

test("statistiques d'incantation du grimoire : attaque de sort et DD", () => {
  const classe = referentiel.obtenirClasse("magicien");
  // Niveau 3 : maitrise +2, Intelligence 16 : +3 -> attaque +5, DD 13.
  assert.deepEqual(statistiquesIncantation(mage, classe), { caracteristique: "intelligence", attaque: 5, dd: 13 });
});
