import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerRegistreComptes, fabriquerEmpreinte, verifierEmpreinte } from "../src/auth/comptes.js";
import { creerGestionnaireSessions } from "../src/auth/sessions.js";

const avecComptes = (options = {}) => creerGestionnaireSessions({ motDePasseMJ: "secret-mj", comptes: creerRegistreComptes(), ...options });

test("premiere connexion : le mot de passe choisi est enregistre, puis exige", async () => {
  const s = avecComptes();
  const premiere = await s.connecter({ role: "joueur", pseudo: "Thrall", motDePasse: "lok-tar-ogar" }, "1.1.1.1");
  assert.equal(premiere.compteCree, true);
  const suivante = await s.connecter({ role: "joueur", pseudo: "thrall ", motDePasse: "lok-tar-ogar" }, "1.1.1.1");
  assert.equal(suivante.compteCree, false);
  await assert.rejects(s.connecter({ role: "joueur", pseudo: "Thrall", motDePasse: "pour-la-horde" }, "1.1.1.2"), /Mot de passe incorrect pour Thrall/);
});

test("on ne peut plus prendre le pseudo d'un autre joueur", async () => {
  const s = avecComptes();
  await s.connecter({ role: "joueur", pseudo: "Jaina", motDePasse: "theramore" }, "1.1.1.1");
  await assert.rejects(s.connecter({ role: "joueur", pseudo: "JAINA", motDePasse: "" }, "6.6.6.6"), /incorrect/);
});

test("premiere connexion avec un mot de passe trop court : refusee, rien n'est cree", async () => {
  const s = avecComptes();
  await assert.rejects(s.connecter({ role: "joueur", pseudo: "Uther", motDePasse: "abc" }, "1.1.1.1"), /au moins 6 caracteres/);
  assert.equal((await s.connecter({ role: "joueur", pseudo: "Uther", motDePasse: "lumiere" }, "1.1.1.1")).compteCree, true);
});

test("les pseudos du MJ sont reserves", async () => {
  const s = avecComptes();
  for (const pseudo of ["MJ", "Maitre du Jeu", "maître du jeu"]) {
    await assert.rejects(s.connecter({ role: "joueur", pseudo, motDePasse: "nimporte" }, "1.1.1.1"), /reserve/);
  }
});

test("5 mauvais mots de passe bloquent l'adresse, pas les autres", async () => {
  const s = avecComptes();
  await s.connecter({ role: "joueur", pseudo: "Sylvanas", motDePasse: "banshee-reine" }, "9.9.9.9");
  for (let i = 0; i < 5; i++) {
    await assert.rejects(s.connecter({ role: "joueur", pseudo: "Sylvanas", motDePasse: "faux-mdp" }, "2.2.2.2"));
  }
  await assert.rejects(s.connecter({ role: "joueur", pseudo: "Sylvanas", motDePasse: "banshee-reine" }, "2.2.2.2"), /Trop d'essais/);
  assert.ok((await s.connecter({ role: "joueur", pseudo: "Sylvanas", motDePasse: "banshee-reine" }, "3.3.3.3")).jeton);
});

test("le MJ reinitialise un mot de passe oublie : le joueur en choisit un nouveau", async () => {
  const s = avecComptes();
  await s.connecter({ role: "joueur", pseudo: "Arthas", motDePasse: "deuillegivre" }, "1.1.1.1");
  assert.equal(s.reinitialiserMotDePasse("arthas"), true);
  assert.equal((await s.connecter({ role: "joueur", pseudo: "Arthas", motDePasse: "nouveau-mdp" }, "1.1.1.1")).compteCree, true);
  assert.equal(s.reinitialiserMotDePasse("Inconnu"), false);
});

test("avec code de table, le joueur doit aussi le donner", async () => {
  const s = avecComptes({ codeTable: "lok-tar" });
  assert.equal(s.codeTableRequis, true);
  await assert.rejects(s.connecter({ role: "joueur", pseudo: "Rexxar", motDePasse: "misha-ours" }, "1.1.1.1"), /Code de la table/);
  assert.ok((await s.connecter({ role: "joueur", pseudo: "Rexxar", motDePasse: "misha-ours", codeTable: "lok-tar" }, "1.1.1.1")).jeton);
});

test("le fichier des comptes ne contient jamais un mot de passe en clair, et survit a un redemarrage", async () => {
  const dossier = mkdtempSync(join(tmpdir(), "vtt-comptes-"));
  try {
    const chemin = join(dossier, "comptes.json");
    await creerRegistreComptes(chemin).verifierOuCreer("Thrall", "lok-tar-ogar");
    assert.doesNotMatch(readFileSync(chemin, "utf8"), /lok-tar-ogar/);
    const relu = creerRegistreComptes(chemin);
    assert.equal(await relu.verifierOuCreer("Thrall", "lok-tar-ogar"), "ok");
    assert.equal(await relu.verifierOuCreer("Thrall", "autre-chose"), "refuse");
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("empreinte : deux fois le meme mot de passe donne deux empreintes differentes (sel)", async () => {
  const a = await fabriquerEmpreinte("secret");
  const b = await fabriquerEmpreinte("secret");
  assert.notEqual(a, b);
  assert.equal(await verifierEmpreinte("secret", a), true);
  assert.equal(await verifierEmpreinte("Secret", a), false);
});
