// Medias : les textures d'interface se servent avec leurs sous-dossiers,
// sans jamais permettre de sortir du dossier.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import express from "express";
import { creerBibliothequeIcones } from "../src/donnees/bibliotheque-icones.js";
import { routesMedias } from "../src/medias.js";

const racine = mkdtempSync(join(tmpdir(), "vtt-medias-"));
const dossiers = {};
for (const c of ["jetons", "portraits", "cartes", "icones", "polices", "sons", "interface"]) {
  dossiers[c] = join(racine, c);
  mkdirSync(dossiers[c]);
}
mkdirSync(join(dossiers.interface, "Buttons"));
writeFileSync(join(dossiers.interface, "Buttons", "UI-Quickslot2.png"), "PNG");
writeFileSync(join(dossiers.interface, "WOWUNKNOWNITEM01.PNG"), "INCONNUE"); // rangee a plat, en majuscules
writeFileSync(join(dossiers.interface, "LISEZ-MOI.txt"), "pas une image");
writeFileSync(join(dossiers.interface, ".cache.png"), "fichier cache");
writeFileSync(join(racine, "secret.txt"), "ne doit pas sortir");
let serveur;
let adresse;

before(async () => {
  const app = express();
  app.use(routesMedias({ dossiers }));
  serveur = createServer(app);
  await new Promise((ok) => serveur.listen(0, "127.0.0.1", ok));
  adresse = `http://127.0.0.1:${serveur.address().port}`;
});
after(() => {
  serveur.close();
  rmSync(racine, { recursive: true, force: true });
});

test("interface/ : sous-dossiers servis, sortie du dossier refusee, absent = 404", async () => {
  const ok = await fetch(`${adresse}/medias/interface/Buttons/UI-Quickslot2.png`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "PNG");
  for (const piege of ["/medias/interface/../secret.txt", "/medias/interface/%2e%2e/secret.txt", "/medias/interface/Buttons/..%2f..%2fsecret.txt"]) {
    const r = await fetch(`${adresse}${piege}`);
    assert.notEqual(await r.text(), "ne doit pas sortir", piege);
  }
  assert.equal((await fetch(`${adresse}/medias/interface/Buttons/Absent.png`)).status, 404);
});

test("/api/interface : liste les images (sous-dossiers compris), sans fichiers caches ni texte", async () => {
  const r = await fetch(`${adresse}/api/interface`);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).fichiers, ["Buttons/UI-Quickslot2.png", "WOWUNKNOWNITEM01.PNG"]);
});

test("icone absente : le point d'interrogation de WoW s'il est dans interface/, 404 si remplacement=non", async () => {
  const r = await fetch(`${adresse}/medias/icones/epee-introuvable`);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "INCONNUE");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal((await fetch(`${adresse}/medias/icones/epee-introuvable?remplacement=non`)).status, 404);
  // Les autres categories gardent leur carre gris.
  assert.match((await fetch(`${adresse}/medias/jetons/absent`)).headers.get("content-type"), /svg/);
});

test("bibliotheque d'icones : lue une fois, recherche multi-mots, limite, actualisation", async () => {
  for (let i = 0; i < 300; i++) writeFileSync(join(dossiers.icones, `inv_misc_${String(i).padStart(3, "0")}.png`), "x");
  writeFileSync(join(dossiers.icones, "spell_fire_fireball02.png"), "x");
  writeFileSync(join(dossiers.icones, "Spell_Fire_Fireball02.jpg"), "x"); // meme nom : une seule fois
  const bibliotheque = creerBibliothequeIcones(dossiers.icones);
  const tout = await bibliotheque.chercher("misc");
  assert.equal(tout.trouves, 300);
  assert.equal(tout.icones.length, 240); // jamais toute la liste d'un coup
  const feu = (await bibliotheque.chercher("fire ball")).icones;
  assert.deepEqual(feu.map((n) => n.toLowerCase()), ["spell_fire_fireball02"]); // une seule fois, quelle que soit la casse
  writeFileSync(join(dossiers.icones, "inv_sword_04.png"), "x");
  assert.equal((await bibliotheque.chercher("sword")).icones.length, 0); // pas encore relu
  await bibliotheque.actualiser();
  assert.deepEqual((await bibliotheque.chercher("sword")).icones, ["inv_sword_04"]);
  assert.equal((await creerBibliothequeIcones(join(racine, "absent")).chercher("")).total, 0);
});
