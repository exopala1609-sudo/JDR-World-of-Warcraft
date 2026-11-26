// Renommee et langues modifiees en jeu par le MJ (etape 3).
import assert from "node:assert/strict";
import { test } from "node:test";
import { changerLangue, changerRenommee } from "../src/regles/renommee.js";

test("renommee : +/- a partir de 0, valeur fixee, faction retiree", () => {
  let r = changerRenommee([], "forgefer", { variation: 2 });
  assert.deepEqual(r, { renommees: [{ faction: "forgefer", score: 2 }], avant: null, apres: 2 });
  r = changerRenommee(r.renommees, "forgefer", { variation: -5 });
  assert.equal(r.apres, -3);
  r = changerRenommee(r.renommees, "forgefer", { score: 25 });
  assert.deepEqual([r.avant, r.apres], [-3, 25]);
  r = changerRenommee(r.renommees, "forgefer", { score: null });
  assert.deepEqual(r.renommees, []);
  assert.throws(() => changerRenommee([], "forgefer", { score: null }), /pas de renommee/);
  assert.equal(changerRenommee([], "kirin-tor", { score: 5000 }).apres, 1000); // plafond
});

test("langues : ajouter, retirer, sans doublon", () => {
  assert.deepEqual(changerLangue(["orc"], "kalimag", true), ["orc", "kalimag"]);
  assert.deepEqual(changerLangue(["orc", "kalimag"], "orc", false), ["kalimag"]);
  assert.throws(() => changerLangue(["orc"], "orc", true), /deja/);
  assert.throws(() => changerLangue(["orc"], "nain", false), /ne connait pas/);
});
