import assert from "node:assert/strict";
import { test } from "node:test";
import { COULEUR_MJ, couleurDe, couleurPour } from "../../shared/couleurs.js";
import { effacerTraces, LIMITES_DESSIN, prolongerTrace } from "../src/regles/dessins.js";
import { appliquerPointsDeVie, texteDeCombat } from "../src/regles/points-de-vie.js";

const CARTE = { largeur: 2000, hauteur: 1000 };
const PV = { max: 20, actuels: 12, temporaires: 5 };

// --- Textes de combat flottants -------------------------------------------------

test("degats : le montant total, avec la part absorbee par les PV temporaires", () => {
  const { detail } = appliquerPointsDeVie(PV, "degats", 8);
  assert.deepEqual(texteDeCombat(detail), { genre: "degats", montant: 8, critique: false, absorbe: 5 });
  assert.equal(texteDeCombat(detail, { critique: true }).critique, true);
});

test("soins : seulement ce qui a vraiment ete rendu", () => {
  const { detail } = appliquerPointsDeVie(PV, "soins", 50);
  assert.deepEqual(texteDeCombat(detail), { genre: "soins", montant: 8, critique: false, absorbe: 0 });
  // Deja au maximum : aucun texte (pas de "+0" qui flotte).
  const plein = appliquerPointsDeVie({ ...PV, actuels: 20 }, "soins", 5).detail;
  assert.equal(texteDeCombat(plein), null);
});

test("un soin n'est jamais critique ; PV temporaires et degats nuls n'affichent rien", () => {
  const soin = appliquerPointsDeVie(PV, "soins", 3).detail;
  assert.equal(texteDeCombat(soin, { critique: true }).critique, false);
  assert.equal(texteDeCombat(appliquerPointsDeVie(PV, "temporaires", 10).detail), null);
  assert.equal(texteDeCombat(appliquerPointsDeVie(PV, "degats", 0).detail), null);
});

test("repos : les PV recuperes s'affichent en soins", () => {
  assert.deepEqual(texteDeCombat({ repos: "court", pvRecuperes: 7 }), { genre: "soins", montant: 7, critique: false, absorbe: 0 });
  assert.equal(texteDeCombat({ repos: "long", pvRecuperes: 0 }), null);
});

// --- Traces tactiques ----------------------------------------------------------------

test("une trace porte le nom de son auteur, fabrique par le serveur", () => {
  const { traces, trace, morceau } = prolongerTrace([], { auteur: "Thrall", cle: "abc123", couleur: "#ff0000", points: [[10.04, 20]] }, CARTE);
  assert.equal(trace.id, "thrall:abc123");
  assert.equal(trace.auteur, "Thrall");
  assert.deepEqual(morceau, [[10, 20]]);
  assert.equal(traces.length, 1);
});

test("les morceaux suivants prolongent la trace ; les points restent dans la carte", () => {
  let { traces } = prolongerTrace([], { auteur: "Thrall", cle: "abc123", couleur: "#ff0000", points: [[0, 0]] }, CARTE);
  ({ traces } = prolongerTrace(traces, { auteur: "Thrall", cle: "abc123", couleur: "#ff0000", points: [[5000, -40]] }, CARTE));
  assert.deepEqual(traces[0].points, [[0, 0], [2000, 0]]);
});

test("meme cle, autre auteur : deux traces distinctes (impossible de prolonger celle d'un autre)", () => {
  let { traces } = prolongerTrace([], { auteur: "Thrall", cle: "abc123", couleur: "#ff0000", points: [[0, 0]] }, CARTE);
  ({ traces } = prolongerTrace(traces, { auteur: "Jaina", cle: "abc123", couleur: "#00ff00", points: [[9, 9]] }, CARTE));
  assert.deepEqual(traces.map((t) => t.id), ["thrall:abc123", "jaina:abc123"]);
  assert.deepEqual(traces[0].points, [[0, 0]]);
});

test("limites : longueur d'une trace et nombre de traces par table", () => {
  const long = Array.from({ length: LIMITES_DESSIN.pointsParTrace }, (_, i) => [i % 2000, 0]);
  const pleine = [{ id: "thrall:x", auteur: "Thrall", couleur: "#fff", points: long }];
  assert.throws(() => prolongerTrace(pleine, { auteur: "Thrall", cle: "x", couleur: "#fff", points: [[1, 1]] }, CARTE), /trop longue/);
  const beaucoup = Array.from({ length: LIMITES_DESSIN.tracesParTable }, (_, i) => ({ id: `a:${i}`, auteur: "a", couleur: "#fff", points: [] }));
  assert.throws(() => prolongerTrace(beaucoup, { auteur: "b", cle: "neuve", couleur: "#fff", points: [[1, 1]] }, CARTE), /Trop de traces/);
});

test("effacer : ses propres traces (sans tenir compte des majuscules), ou toutes", () => {
  const traces = [
    { id: "thrall:a", auteur: "Thrall", points: [] },
    { id: "jaina:b", auteur: "Jaina", points: [] },
  ];
  assert.deepEqual(effacerTraces(traces, "THRALL").map((t) => t.id), ["jaina:b"]);
  assert.deepEqual(effacerTraces(traces, null), []);
});

test("couleurs : stables par joueur, or pour le MJ, rouge pour les PNJ", () => {
  assert.equal(couleurPour("Thrall"), couleurPour("thrall"));
  assert.equal(couleurDe({ role: "joueur", pseudo: "Thrall" }), couleurPour("Thrall"));
  assert.equal(couleurDe({ role: "mj", pseudo: "Maitre du Jeu" }), COULEUR_MJ);
  assert.equal(couleurPour(null), "#b22222");
});
