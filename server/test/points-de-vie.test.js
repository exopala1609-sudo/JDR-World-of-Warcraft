import assert from "node:assert/strict";
import { test } from "node:test";
import { appliquerPointsDeVie } from "../src/regles/points-de-vie.js";
import { ErreurRegle } from "../src/regles/erreurs.js";

const pv = (actuels, max = 20, temporaires = 0) => ({ max, actuels, temporaires });

test("les degats retirent des PV", () => {
  assert.deepEqual(appliquerPointsDeVie(pv(20), "degats", 7).pointsDeVie, pv(13));
});

test("les PV ne descendent jamais sous 0", () => {
  const { pointsDeVie, detail } = appliquerPointsDeVie(pv(5), "degats", 30);
  assert.equal(pointsDeVie.actuels, 0);
  assert.equal(detail.aTerre, true);
});

test("les PV temporaires encaissent en premier", () => {
  const { pointsDeVie, detail } = appliquerPointsDeVie(pv(20, 20, 5), "degats", 8);
  assert.deepEqual(pointsDeVie, pv(17, 20, 0));
  assert.equal(detail.absorbesParTemporaires, 5);
});

test("les soins ne depassent pas le maximum", () => {
  assert.equal(appliquerPointsDeVie(pv(18), "soins", 10).pointsDeVie.actuels, 20);
});

test("les PV temporaires ne se cumulent pas : on garde le plus eleve", () => {
  assert.equal(appliquerPointsDeVie(pv(20, 20, 8), "temporaires", 5).pointsDeVie.temporaires, 8);
  assert.equal(appliquerPointsDeVie(pv(20, 20, 3), "temporaires", 5).pointsDeVie.temporaires, 5);
});

test("montants negatifs ou non entiers refuses", () => {
  assert.throws(() => appliquerPointsDeVie(pv(20), "soins", -5), ErreurRegle);
  assert.throws(() => appliquerPointsDeVie(pv(20), "degats", 2.5), ErreurRegle);
});
