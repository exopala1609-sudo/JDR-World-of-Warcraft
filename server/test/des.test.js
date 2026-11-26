import assert from "node:assert/strict";
import { test } from "node:test";
import { lancerDes } from "../src/regles/des.js";
import { ErreurRegle } from "../src/regles/erreurs.js";

test("1d20+5 donne un total entre 6 et 25", () => {
  for (let i = 0; i < 500; i++) {
    const { total, termes } = lancerDes("1d20+5");
    assert.ok(total >= 6 && total <= 25, `total hors limites : ${total}`);
    assert.equal(termes.length, 2);
  }
});

test("tous les resultats d'un d6 finissent par sortir (le hasard couvre toutes les faces)", () => {
  const vus = new Set();
  for (let i = 0; i < 300; i++) vus.add(lancerDes("d6").total);
  assert.deepEqual([...vus].sort(), [1, 2, 3, 4, 5, 6]);
});

test("avantage (2d20kh1) garde le meilleur des deux", () => {
  for (let i = 0; i < 200; i++) {
    const [terme] = lancerDes("2d20kh1").termes;
    assert.equal(terme.jets.length, 2);
    assert.equal(terme.valeur, Math.max(...terme.jets));
  }
});

test("desavantage (2d20kl1) garde le pire des deux", () => {
  for (let i = 0; i < 200; i++) {
    const [terme] = lancerDes("2d20kl1").termes;
    assert.equal(terme.valeur, Math.min(...terme.jets));
  }
});

test("formule composee avec soustraction", () => {
  const { termes, total } = lancerDes("2d6 + 1d4 - 1");
  assert.equal(termes.length, 3);
  assert.equal(termes[2].valeur, -1);
  assert.equal(total, termes[0].valeur + termes[1].valeur - 1);
});

test("les formules invalides ou abusives sont refusees", () => {
  for (const formule of ["", "abc", "1d1", "1d20+", "d", "1000d6", "2d20kh3", "1d20;rm", "99d6+99d6+99d6"]) {
    assert.throws(() => lancerDes(formule), ErreurRegle, `aurait du refuser "${formule}"`);
  }
});
