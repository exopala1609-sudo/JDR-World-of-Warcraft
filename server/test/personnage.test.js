import assert from "node:assert/strict";
import { test } from "node:test";
import { apercuPersonnage, baseParDefaut, pointsDepenses, pvMax, verifierBase, verifierChoixBonus } from "../../shared/creation.js";
import { fabriquerPersonnage, fabriquerPersonnageGuide } from "../src/modeles/personnage.js";
import { ErreurRegle } from "../src/regles/erreurs.js";
import { referentielExemple } from "./aides.js";

const referentiel = referentielExemple();
const regles = referentiel.reglesCreation();
const caracs = { force: 16, dexterite: 14, constitution: 14, intelligence: 10, sagesse: 12, charisme: 8 };
const contexte = { idTable: "t-0123456789", proprietaire: "Hadrien", referentiel };

// --- Regles partagees (shared/creation.js) ------------------------------------------------

test("PV max : de de vie complet au niveau 1, valeur fixe ensuite, bonus de race par niveau", () => {
  assert.equal(pvMax(10, 1, 14), 12); // d10 + 2
  assert.equal(pvMax(6, 1, 8), 5); // d6 - 1
  assert.equal(pvMax(10, 5, 14), 12 + 4 * (6 + 2)); // 44
  assert.equal(pvMax(10, 1, 14, 1), 13); // robustesse naine
});

test("tableau standard : exactement les 6 valeurs, dans n'importe quel ordre", () => {
  const ok = { force: 8, dexterite: 15, constitution: 14, intelligence: 13, sagesse: 12, charisme: 10 };
  assert.equal(verifierBase("tableau-standard", ok, regles), null);
  assert.match(verifierBase("tableau-standard", { ...ok, force: 15 }, regles), /tableau standard/);
});

test("achat de points : 27 points, scores de 8 a 15 avant les bonus de race", () => {
  const base = { force: 15, dexterite: 15, constitution: 15, intelligence: 8, sagesse: 8, charisme: 8 };
  assert.equal(pointsDepenses(base, regles), 27);
  assert.equal(verifierBase("achat-de-points", base, regles), null);
  assert.match(verifierBase("achat-de-points", { ...base, intelligence: 9 }, regles), /28 points depenses pour 27/);
  assert.match(verifierBase("achat-de-points", { ...base, force: 16 }, regles), /de 8 a 15/);
  assert.deepEqual(Object.values(baseParDefaut("achat-de-points", regles)), [8, 8, 8, 8, 8, 8]);
});

test("tableau standard par defaut : les meilleures valeurs vont aux caracteristiques principales", () => {
  const base = baseParDefaut("tableau-standard", regles, ["dexterite", "sagesse"]);
  assert.equal(base.dexterite, 15);
  assert.equal(base.sagesse, 14);
  assert.equal(verifierBase("tableau-standard", base, regles), null);
});

test("bonus au choix (regles 2024) : un par caracteristique differente", () => {
  const race = { bonusAuChoix: { bonus: [2, 1], parmi: "toutes" } };
  assert.equal(verifierChoixBonus(race, ["force", "constitution"]), null);
  assert.match(verifierChoixBonus(race, ["force", "force"]), /differente/);
  assert.match(verifierChoixBonus(race, ["force"]), /2 bonus/);
  assert.equal(verifierChoixBonus({}, []), null); // race sans bonus au choix
});

test("apercu : bonus de race, CA de classe et ressources tires des fichiers JSON", () => {
  const liste = referentiel.lister();
  const nain = referentiel.obtenirRace("nain");
  const base = { force: 15, dexterite: 14, constitution: 13, intelligence: 12, sagesse: 10, charisme: 8 };
  const guerrier = apercuPersonnage({ race: nain, classe: referentiel.obtenirClasse("guerrier"), base }, liste);
  assert.equal(guerrier.caracteristiques.constitution, 15); // 13 + 2 (nain)
  assert.equal(guerrier.caracteristiques.force, 16); // 15 + 1
  assert.equal(guerrier.pvMax, 10 + 2 + 1); // d10 + CON +2 + robustesse naine
  assert.deepEqual(guerrier.ressources.map((r) => [r.cle, r.actuel, r.max]), [["rage", 0, 100], ["second-souffle", 1, 1]]);

  const moine = apercuPersonnage({ race: referentiel.obtenirRace("pandaren"), classe: referentiel.obtenirClasse("moine"), base }, liste);
  assert.equal(moine.classeArmure, 10 + 2 + 1); // 10 + DEX + SAG (12 : 10 + 2 pandaren)

  const barde = apercuPersonnage({ race: referentiel.obtenirRace("humain"), classe: referentiel.obtenirClasse("barde"), base }, liste);
  assert.equal(barde.ressources.find((r) => r.cle === "inspiration-bardique").max, 1); // CHA 9 : mod -1, minimum 1
});

// --- Creation guidee (joueur) ------------------------------------------------------------

const choixValides = {
  nom: "Garrosh",
  faction: "horde",
  race: "orc",
  classe: "guerrier",
  methode: "tableau-standard",
  caracteristiques: { force: 15, dexterite: 12, constitution: 14, intelligence: 8, sagesse: 13, charisme: 10 },
};

test("creation guidee : le serveur applique les regles du referentiel", () => {
  const p = fabriquerPersonnageGuide(choixValides, contexte);
  assert.equal(p.versionSchema, 3);
  assert.deepEqual([p.race, p.faction, p.classe, p.niveau, p.portrait], ["orc", "horde", "guerrier", 1, null]);
  assert.equal(p.caracteristiques.force, 17); // 15 + 2 (orc)
  assert.equal(p.caracteristiques.constitution, 15); // 14 + 1
  assert.equal(p.pointsDeVie.max, 12); // d10 + 2
  assert.equal(p.proprietaire, "Hadrien");
});

test("creation guidee : chaque tricherie ou incoherence est refusee avec un message clair", () => {
  const refus = (changement, motif) =>
    assert.throws(() => fabriquerPersonnageGuide({ ...choixValides, ...changement }, contexte), (e) => e instanceof ErreurRegle && motif.test(e.message));
  refus({ race: "tauren", classe: "chasseur-de-demons" }, /pas accessible a cette race/);
  refus({ race: "nain" }, /indisponible pour la faction Horde/);
  refus({ classe: "necromancien" }, /Classe inconnue/);
  refus({ caracteristiques: { ...choixValides.caracteristiques, force: 18 } }, /tableau standard/);
  const quatreQuinze = { force: 15, dexterite: 15, constitution: 15, intelligence: 15, sagesse: 8, charisme: 8 };
  refus({ methode: "achat-de-points", caracteristiques: quatreQuinze }, /36 points depenses pour 27/);
  refus({ portrait: "orc-1.png" }, /Portrait introuvable/);
  refus({ bonusAuChoix: ["force"] }, /pas de bonus au choix/);
  // Un navigateur ne peut pas imposer ses PV ni un niveau.
  assert.throws(() => fabriquerPersonnageGuide({ ...choixValides, niveau: 20 }, contexte));
  assert.throws(() => fabriquerPersonnageGuide({ ...choixValides, pvMax: 999 }, contexte));
});

test("creation guidee : portrait choisi parmi les fichiers du dossier", () => {
  const p = fabriquerPersonnageGuide({ ...choixValides, portrait: "orc-1.png" }, { ...contexte, portraits: ["orc-1.png"] });
  assert.equal(p.portrait, "orc-1.png");
});

test("restrictions desactivees dans creation.json : le Tauren peut devenir Chasseur de demons", () => {
  const permissif = { ...referentiel, combinaisonPermise: () => true };
  const p = fabriquerPersonnageGuide({ ...choixValides, race: "tauren", classe: "chasseur-de-demons" }, { ...contexte, referentiel: permissif });
  assert.equal(p.classe, "chasseur-de-demons");
});

// --- Creation libre (MJ) -------------------------------------------------------------------

test("creation libre du MJ : caracteristiques prises telles quelles, valeurs derivees calculees", () => {
  const p = fabriquerPersonnage({ nom: "Jaina", classe: "magicien", caracteristiques: caracs }, contexte);
  assert.equal(p.pointsDeVie.max, 8);
  assert.equal(p.classeArmure, 12);
  assert.equal(p.desDeVie.faces, 6);
  assert.deepEqual(p.ressources.map((r) => r.cle), ["mana", "emplacements-niveau-1"]);
  assert.deepEqual([p.race, p.faction], [null, null]);
  assert.match(p.id, /^p-[0-9a-f]{10}$/);
});

test("Defense sans armure du Barbare et du Moine, lue dans classes.json", () => {
  const barbare = fabriquerPersonnage({ nom: "Garrosh", classe: "barbare", caracteristiques: caracs }, contexte);
  const moine = fabriquerPersonnage({ nom: "Chen", classe: "moine", caracteristiques: caracs }, contexte);
  assert.equal(barbare.classeArmure, 10 + 2 + 2);
  assert.equal(moine.classeArmure, 10 + 2 + 1);
});

test("creation libre : champs inconnus, caracteristiques hors limites et classe inconnue refuses", () => {
  const pv = { max: 999, actuels: 999, temporaires: 0 };
  assert.throws(() => fabriquerPersonnage({ nom: "Triche", classe: "guerrier", caracteristiques: caracs, pointsDeVie: pv }, contexte));
  assert.throws(() => fabriquerPersonnage({ nom: "Titan", classe: "guerrier", caracteristiques: { ...caracs, force: 45 } }, contexte));
  assert.throws(() => fabriquerPersonnage({ nom: "X", classe: "inconnue", caracteristiques: caracs }, contexte), /Classe inconnue/);
});
