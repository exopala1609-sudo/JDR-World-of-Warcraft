// Televersement d'une carte : reserve au MJ, format verifie sur le contenu.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import express from "express";
import { creerGestionnaireSessions } from "../src/auth/sessions.js";
import { formatImage, nomPropre, routesTeleversement } from "../src/televersement.js";

const dossier = mkdtempSync(join(tmpdir(), "vtt-cartes-"));
const sessions = creerGestionnaireSessions({ motDePasseMJ: "secret-de-test" });
let serveur;
let adresse;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

before(async () => {
  const app = express();
  app.use(routesTeleversement({ dossiers: { cartes: dossier } }, sessions));
  serveur = createServer(app);
  await new Promise((ok) => serveur.listen(0, "127.0.0.1", ok));
  adresse = `http://127.0.0.1:${serveur.address().port}`;
});
after(() => {
  serveur.close();
  rmSync(dossier, { recursive: true, force: true });
});

const envoyer = (jeton, corps, nom = "Foret d'Elwynn.png") =>
  fetch(`${adresse}/api/cartes?nom=${encodeURIComponent(nom)}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
    body: corps,
  });

test("format reconnu sur les premiers octets ; nom de fichier nettoye", () => {
  assert.equal(formatImage(PNG), "png");
  assert.equal(formatImage(Buffer.from("<html><script>alert(1)</script>")), null);
  assert.equal(nomPropre("Foret d'Elwynn (nuit).JPG"), "foret-d-elwynn-nuit");
  assert.equal(nomPropre("../../.env"), "carte"); // ni dossier, ni "..": un nom neutre
});

test("un joueur (ou personne) ne peut pas televerser ; le MJ oui, sans jamais ecraser", async () => {
  assert.equal((await envoyer(null, PNG)).status, 401);
  const joueur = (await sessions.connecter({ role: "joueur", pseudo: "Thrall" })).jeton;
  assert.equal((await envoyer(joueur, PNG)).status, 401);

  const mj = (await sessions.connecter({ role: "mj", motDePasse: "secret-de-test" })).jeton;
  assert.equal((await (await envoyer(mj, PNG)).json()).fichier, "foret-d-elwynn.png");
  assert.equal((await (await envoyer(mj, PNG)).json()).fichier, "foret-d-elwynn-2.png");
  const deguise = await envoyer(mj, Buffer.from("<html>pas une image</html>"), "piege.png");
  assert.equal(deguise.status, 415);
  assert.deepEqual(readdirSync(dossier).sort(), ["foret-d-elwynn-2.png", "foret-d-elwynn.png"]);
  assert.equal(existsSync(join(dossier, "piege.png")), false);
});
