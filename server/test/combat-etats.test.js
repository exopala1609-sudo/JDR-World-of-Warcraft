import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ajouterParticipant,
  creerCombat,
  deplacerParticipant,
  fixerInitiative,
  retirerParticipant,
  tourPrecedent,
  tourSuivant,
} from "../src/regles/combat.js";
import { ErreurRegle } from "../src/regles/erreurs.js";
import { ecoulerUnRound, poserEtat, retirerEtat } from "../src/regles/etats.js";

let compteur = 0;
const participant = (nom, initiative, dexterite = 10, departage = 0) => ({
  id: `c-${String(++compteur).padStart(10, "0")}`,
  idPersonnage: `p-${String(compteur).padStart(10, "0")}`,
  nom, jet: 10, bonus: 0, initiative, dexterite, departage,
});

test("l'ordre suit l'initiative, puis la Dexterite, puis le tirage au sort", () => {
  const combat = creerCombat("t-0123456789", [
    participant("Lent", 5),
    participant("Rapide", 18),
    participant("Egal-agile", 12, 16),
    participant("Egal-maladroit", 12, 8),
    participant("Egal-chanceux", 5, 10, 999),
  ]);
  assert.deepEqual(combat.participants.map((p) => p.nom), ["Rapide", "Egal-agile", "Egal-maladroit", "Egal-chanceux", "Lent"]);
});

test("tour suivant : on avance, puis nouveau round apres le dernier", () => {
  let combat = creerCombat("t-0123456789", [participant("A", 20), participant("B", 10)]);
  let r = tourSuivant(combat);
  assert.equal(r.finDeTour.nom, "A");
  assert.equal(r.combat.participants[r.combat.indexActif].nom, "B");
  r = tourSuivant(r.combat);
  assert.equal(r.nouveauRound, true);
  assert.equal(r.combat.round, 2);
  assert.equal(r.combat.indexActif, 0);
  combat = tourPrecedent(r.combat);
  assert.equal(combat.round, 1);
  assert.equal(combat.indexActif, 1);
  assert.throws(() => tourPrecedent(creerCombat("t-0123456789", [participant("A", 1)])), ErreurRegle);
});

test("arrivee et depart en plein combat : le combattant actif ne change pas", () => {
  const a = participant("A", 20), b = participant("B", 15), c = participant("C", 10);
  let combat = { ...creerCombat("t-0123456789", [a, b, c]), indexActif: 1 }; // c'est a B
  combat = ajouterParticipant(combat, participant("Rapide", 25));
  assert.equal(combat.participants[combat.indexActif].nom, "B");
  combat = retirerParticipant(combat, a.id);
  assert.equal(combat.participants[combat.indexActif].nom, "B");
  combat = fixerInitiative(combat, c.id, 30);
  assert.equal(combat.participants[combat.indexActif].nom, "B");
  assert.equal(combat.participants[0].nom, "C");
  assert.equal(retirerParticipant(creerCombat("t-0123456789", [a]), a.id), null);
});

test("le MJ reordonne a la main : l'ordre tient meme apres un nouveau tri", () => {
  const a = participant("A", 20), b = participant("B", 15), c = participant("C", 10);
  let combat = { ...creerCombat("t-0123456789", [a, b, c]), indexActif: 1 }; // c'est a B
  combat = deplacerParticipant(combat, c.id, -1); // C passe devant B
  assert.deepEqual(combat.participants.map((p) => p.nom), ["A", "C", "B"]);
  assert.equal(combat.participants[combat.indexActif].nom, "B"); // le tour ne change pas de main
  combat = fixerInitiative(combat, a.id, 1); // un nouveau tri ne defait pas l'ordre manuel
  assert.deepEqual(combat.participants.map((p) => p.nom), ["C", "B", "A"]);
  assert.equal(deplacerParticipant(combat, combat.participants[0].id, -1), combat); // deja en tete
});

const perso = () => ({ etats: [] });
const poison = { cle: "empoisonne", nom: "Empoisonne", nature: "debuff", icone: "empoisonne", description: "" };
const beni = { cle: "benediction", nom: "Benediction", nature: "buff", description: "" };

test("un etat pose porte son identifiant visuel ; le reposer rafraichit sans cumuler", () => {
  let { personnage, etat } = poserEtat(perso(), poison, { rounds: 2, par: "MJ" });
  assert.equal(etat.icone, "empoisonne");
  assert.equal(poserEtat(perso(), beni, { par: "MJ" }).etat.icone, "benediction"); // icone par defaut = cle
  const r = poserEtat(personnage, poison, { rounds: 5, par: "MJ" });
  assert.equal(r.personnage.etats.length, 1);
  assert.equal(r.personnage.etats[0].roundsRestants, 5);
  assert.equal(r.rafraichi, true);
});

test("les durees s'ecoulent en fin de tour ; les etats sans duree restent", () => {
  let { personnage } = poserEtat(perso(), poison, { rounds: 2, par: "MJ" });
  personnage = poserEtat(personnage, beni, { rounds: null, par: "MJ" }).personnage;
  let r = ecoulerUnRound(personnage);
  assert.equal(r.personnage.etats.find((e) => e.cle === "empoisonne").roundsRestants, 1);
  r = ecoulerUnRound(r.personnage);
  assert.deepEqual(r.expires.map((e) => e.cle), ["empoisonne"]);
  assert.deepEqual(r.personnage.etats.map((e) => e.cle), ["benediction"]);
  assert.equal(ecoulerUnRound(r.personnage).change, false);
  assert.throws(() => retirerEtat(r.personnage, "e-0000000000"), ErreurRegle);
});
