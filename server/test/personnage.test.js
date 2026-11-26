import assert from "node:assert/strict";
import { test } from "node:test";
import {
  apercuPersonnage,
  baseParDefaut,
  detailsOrigine,
  pointsDepenses,
  pvMax,
  raceDisponible,
  repartitionParDefaut,
  restrictionDeLore,
  verifierBase,
  verifierChoixBonus,
  verifierOptions,
  verifierRepartitionHistorique,
} from "../../shared/creation.js";
import { fabriquerPersonnage, fabriquerPersonnageGuide } from "../src/modeles/personnage.js";
import { ErreurRegle } from "../src/regles/erreurs.js";
import { referentielExemple, referentielSimule } from "./aides.js";

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

test("apercu : bonus d'historique, CA de classe et ressources tires des fichiers JSON", () => {
  const liste = referentiel.lister();
  const nain = referentiel.obtenirRace("nain");
  const base = { force: 15, dexterite: 14, constitution: 13, intelligence: 12, sagesse: 10, charisme: 8 };
  const repartition = { constitution: 2, force: 1 };
  const guerrier = apercuPersonnage({ race: nain, classe: referentiel.obtenirClasse("guerrier"), base, repartition }, liste);
  assert.equal(guerrier.caracteristiques.constitution, 15); // 13 + 2 (historique)
  assert.equal(guerrier.caracteristiques.force, 16); // 15 + 1
  assert.equal(guerrier.pvMax, 10 + 2 + 1); // d10 + CON +2 + robustesse naine
  assert.deepEqual(guerrier.ressources.map((r) => [r.cle, r.actuel, r.max]), [["rage", 0, 100], ["second-souffle", 1, 1]]);

  const moine = apercuPersonnage({ race: nain, classe: referentiel.obtenirClasse("moine"), base, repartition: { sagesse: 2, dexterite: 1 } }, liste);
  assert.equal(moine.classeArmure, 10 + 2 + 1); // 10 + DEX (15) + SAG (12)
});

test("historique : +2/+1 ou +1/+1/+1, seulement sur ses trois caracteristiques", () => {
  const soldat = referentiel.obtenirHistorique("soldat");
  assert.equal(verifierRepartitionHistorique(soldat, { force: 2, constitution: 1 }), null);
  assert.equal(verifierRepartitionHistorique(soldat, { force: 1, dexterite: 1, constitution: 1 }), null);
  assert.match(verifierRepartitionHistorique(soldat, { sagesse: 2, force: 1 }), /bonus a placer sur/);
  assert.match(verifierRepartitionHistorique(soldat, { force: 2, constitution: 2 }), /\+2 et \+1/);
  assert.match(verifierRepartitionHistorique(null, {}), /Choisis un historique/);
  // Par defaut : +2 sur la caracteristique principale de la classe si possible.
  assert.deepEqual(repartitionParDefaut(soldat, ["dexterite"]), { dexterite: 2, force: 1 });
});

test("options de peuple et details d'origine : taille, type de creature, renommee", () => {
  const simule = referentielSimule();
  const pandaren = simule.obtenirRace("pandaren");
  assert.equal(verifierOptions(pandaren, { philosophie: "huojin" }, "horde", false), null);
  assert.match(verifierOptions(pandaren, { philosophie: "tushui" }, "horde", false), /indisponible pour cette faction/);
  assert.equal(verifierOptions(pandaren, { philosophie: "tushui" }, "horde", true), null); // lore libre
  assert.match(verifierOptions(pandaren, {}, "horde", false), /choisis philosophie/);
  assert.match(verifierOptions(pandaren, { philosophie: "huojin", couleur: "roux" }, "horde", false), /option inconnue/);
  assert.deepEqual(detailsOrigine(pandaren, simule.obtenirClasse("moine"), { philosophie: "huojin" }).renommee, { faction: "Horde", valeur: 3 });
  // Le type de creature vient de la classe, sinon du choix, sinon du peuple.
  assert.equal(detailsOrigine(simule.obtenirRace("dracthyr"), simule.obtenirClasse("guerrier"), {}).typeCreature, "Dragon");
  const humain = simule.obtenirRace("humain");
  assert.equal(detailsOrigine(humain, simule.obtenirClasse("guerrier"), { taille: "petite" }).taille, "petite");
});

test("restriction de lore : l'Evocateur est reserve aux Dracthyrs, le Chasseur de demons aux elfes concernes", () => {
  const simule = referentielSimule();
  const evocateur = simule.obtenirClasse("evocateur");
  const chasseur = simule.obtenirClasse("chasseur-de-demons");
  const elfe = simule.obtenirRace("elfe");
  assert.equal(restrictionDeLore(evocateur, simule.obtenirRace("dracthyr"), {}), null);
  assert.match(restrictionDeLore(evocateur, simule.obtenirRace("orc"), {}), /dracthyrs/);
  assert.equal(restrictionDeLore(chasseur, elfe, { lignee: "drow" }), null);
  assert.match(restrictionDeLore(chasseur, elfe, { lignee: "haut-elfe" }), /elfes seulement/);
  assert.equal(raceDisponible(simule.obtenirRace("humain"), "horde", false), false);
  assert.equal(raceDisponible(simule.obtenirRace("humain"), "horde", true), true);
});

// --- Creation guidee (joueur) ------------------------------------------------------------

const choixValides = {
  nom: "Garrosh",
  faction: "horde",
  race: "orc",
  classe: "guerrier",
  specialisation: "armes",
  historique: "soldat",
  repartition: { force: 2, constitution: 1 },
  methode: "tableau-standard",
  caracteristiques: { force: 15, dexterite: 12, constitution: 14, intelligence: 8, sagesse: 13, charisme: 10 },
};

test("creation guidee : le serveur applique les regles du referentiel", () => {
  const p = fabriquerPersonnageGuide(choixValides, contexte);
  assert.equal(p.versionSchema, 7);
  assert.deepEqual([p.race, p.faction, p.classe, p.niveau, p.portrait], ["orc", "horde", "guerrier", 1, null]);
  assert.equal(p.caracteristiques.force, 17); // 15 + 2 (historique Soldat)
  assert.equal(p.caracteristiques.constitution, 15); // 14 + 1
  assert.equal(p.pointsDeVie.max, 12); // d10 + 2
  assert.equal(p.proprietaire, "Hadrien");
  assert.equal(p.origine.historique, "soldat");
  assert.equal(p.origine.specialisation, "armes");
  assert.deepEqual(p.origine.dons, ["agresseur-sauvage"]);
  assert.equal(p.origine.typeCreature, "Humanoide");
});

test("creation guidee : chaque tricherie ou incoherence est refusee avec un message clair", () => {
  const refus = (changement, motif, ctx = contexte) =>
    assert.throws(() => fabriquerPersonnageGuide({ ...choixValides, ...changement }, ctx), (e) => e instanceof ErreurRegle && motif.test(e.message));
  refus({ race: "nain" }, /indisponible pour la faction Horde/);
  refus({ classe: "necromancien" }, /Classe inconnue/);
  refus({ caracteristiques: { ...choixValides.caracteristiques, force: 18 } }, /tableau standard/);
  const quatreQuinze = { force: 15, dexterite: 15, constitution: 15, intelligence: 15, sagesse: 8, charisme: 8 };
  refus({ methode: "achat-de-points", caracteristiques: quatreQuinze }, /36 points depenses pour 27/);
  refus({ portrait: "orc-1.png" }, /Portrait introuvable/);
  refus({ bonusAuChoix: ["force"] }, /pas de bonus au choix/);
  refus({ historique: undefined, repartition: {} }, /Choisis un historique/);
  refus({ historique: "pirate" }, /Historique inconnu/);
  refus({ repartition: { sagesse: 2, force: 1 } }, /bonus a placer sur/);
  refus({ specialisation: undefined }, /choisis une specialisation/);
  refus({ specialisation: "feu" }, /choisis une specialisation/);
  refus({ donSupplementaire: "vigilant" }, /pas de don d'origine supplementaire/);
  refus({ ignorerLore: true }, /n'autorise pas le lore libre/);
  // Un navigateur ne peut pas imposer ses PV ni un niveau.
  assert.throws(() => fabriquerPersonnageGuide({ ...choixValides, niveau: 20 }, contexte));
  assert.throws(() => fabriquerPersonnageGuide({ ...choixValides, pvMax: 999 }, contexte));
});

test("creation guidee : l'Humain choisit un don d'origine en plus, parmi ceux de son peuple", () => {
  const humain = { ...choixValides, faction: "alliance", race: "humain", options: { taille: "moyenne" } };
  const p = fabriquerPersonnageGuide({ ...humain, donSupplementaire: "vigilant" }, contexte);
  assert.deepEqual(p.origine.dons, ["agresseur-sauvage", "vigilant"]);
  const ctx = { ...contexte, referentiel: referentielSimule() };
  assert.throws(() => fabriquerPersonnageGuide(humain, ctx), /choisis un don d'origine supplementaire/);
  assert.throws(() => fabriquerPersonnageGuide({ ...humain, donSupplementaire: "don-des-elfes" }, ctx), /reserve a d'autres peuples/);
});

test("creation guidee : restriction de lore, levee seulement si le MJ autorise le lore libre", () => {
  const ctx = { ...contexte, referentiel: referentielSimule() };
  const evocateurOrc = { ...choixValides, classe: "evocateur", specialisation: "devastation" };
  assert.throws(() => fabriquerPersonnageGuide(evocateurOrc, ctx), /dracthyrs/);
  assert.throws(() => fabriquerPersonnageGuide({ ...evocateurOrc, ignorerLore: true }, ctx), /n'autorise pas/);
  const p = fabriquerPersonnageGuide({ ...evocateurOrc, ignorerLore: true }, { ...ctx, loreLibre: true });
  assert.equal(p.classe, "evocateur");
  // Un Dracthyr peut etre Evocateur sans lore libre ; son type de creature est garde.
  const dracthyr = fabriquerPersonnageGuide({ ...evocateurOrc, race: "dracthyr" }, ctx);
  assert.equal(dracthyr.origine.typeCreature, "Dragon");
});

test("creation guidee : le Pandaren de la Horde suit la philosophie Huojin, et la renommee est notee", () => {
  const ctx = { ...contexte, referentiel: referentielSimule() };
  const pandaren = { ...choixValides, race: "pandaren", classe: "moine", specialisation: "tisse-brume" };
  assert.throws(() => fabriquerPersonnageGuide({ ...pandaren, options: { philosophie: "tushui" } }, ctx), /indisponible pour cette faction/);
  const p = fabriquerPersonnageGuide({ ...pandaren, options: { philosophie: "huojin" } }, ctx);
  assert.deepEqual(p.origine.optionsRace, { philosophie: "huojin" });
  assert.deepEqual(p.origine.renommee, { faction: "Horde", valeur: 3 });
});

test("creation guidee : portrait choisi parmi les fichiers du dossier", () => {
  const p = fabriquerPersonnageGuide({ ...choixValides, portrait: "orc-1.png" }, { ...contexte, portraits: ["orc-1.png"] });
  assert.equal(p.portrait, "orc-1.png");
});

test("restrictions desactivees dans creation.json : plus de controle de lore", () => {
  const simule = referentielSimule();
  const permissif = { ...simule, reglesCreation: () => ({ ...simule.reglesCreation(), restrictionsRaceClasse: false }) };
  const p = fabriquerPersonnageGuide({ ...choixValides, classe: "evocateur", specialisation: "devastation" }, { ...contexte, referentiel: permissif });
  assert.equal(p.classe, "evocateur");
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

test("Defense sans armure du Chaman (Barbare du livre) et du Moine, lue dans classes.json", () => {
  const barbare = fabriquerPersonnage({ nom: "Garrosh", classe: "chaman", caracteristiques: caracs }, contexte);
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

test("creation guidee : le sexe choisi est garde (portrait par defaut race + sexe), absent = null", () => {
  assert.equal(fabriquerPersonnageGuide({ ...choixValides, sexe: "feminin" }, contexte).sexe, "feminin");
  assert.equal(fabriquerPersonnageGuide(choixValides, contexte).sexe, null);
  assert.throws(() => fabriquerPersonnageGuide({ ...choixValides, sexe: "autre" }, contexte));
});
