import { test } from "node:test";
import assert from "node:assert/strict";
import { creerGestionnaireSessions } from "../src/auth/sessions.js";

test("sans code de table, un pseudo suffit", () => {
  const s = creerGestionnaireSessions({ motDePasseMJ: "secret-mj" });
  assert.equal(s.codeTableRequis, false);
  assert.ok(s.connecter({ role: "joueur", pseudo: "Thrall" }, "1.1.1.1").jeton);
});

test("avec code de table, le joueur doit le donner", () => {
  const s = creerGestionnaireSessions({ motDePasseMJ: "secret-mj", codeTable: "lok-tar" });
  assert.throws(() => s.connecter({ role: "joueur", pseudo: "Thrall" }, "1.1.1.1"), /Code de la table/);
  assert.ok(s.connecter({ role: "joueur", pseudo: "Thrall", motDePasse: "lok-tar" }, "1.1.1.1").jeton);
});

test("5 mauvais codes bloquent l'adresse", () => {
  const s = creerGestionnaireSessions({ motDePasseMJ: "secret-mj", codeTable: "lok-tar" });
  for (let i = 0; i < 5; i++) {
    assert.throws(() => s.connecter({ role: "joueur", pseudo: "X1", motDePasse: "faux" }, "2.2.2.2"));
  }
  assert.throws(
    () => s.connecter({ role: "joueur", pseudo: "X1", motDePasse: "lok-tar" }, "2.2.2.2"),
    /Trop d'essais/,
  );
  // Une autre adresse n'est pas penalisee.
  assert.ok(s.connecter({ role: "joueur", pseudo: "X1", motDePasse: "lok-tar" }, "3.3.3.3").jeton);
});
