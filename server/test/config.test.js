// La configuration d'un poste : ou vivent les donnees de jeu.
// Le bug du sprint 7 : sur un PC neuf, le .env pointait vers un dossier DANS
// le projet ; les parties y etaient sauvegardees, invisibles depuis l'autre PC.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { construireConfig, RACINE } from "../src/config.js";

test("sans VTT_ASSETS, aucun dossier de secours : le serveur doit refuser de demarrer", () => {
  for (const vide of [{}, { VTT_ASSETS: "" }, { VTT_ASSETS: '  ""  ' }]) {
    const config = construireConfig(vide);
    assert.equal(config.racineAssets, null);
    assert.equal(config.dossiers.parties, null);
    assert.match(config.problemes[0], /VTT_ASSETS est vide/);
  }
});

test("un chemin relatif (l'ancien ./donnees-mj) est refuse", () => {
  const config = construireConfig({ VTT_ASSETS: "./donnees-mj" });
  assert.equal(config.dossiers.parties, null);
  assert.match(config.problemes[0], /pas un chemin absolu/);
});

test("un dossier situe dans le projet est refuse, meme ecrit en absolu", () => {
  for (const dedans of [RACINE, join(RACINE, "donnees-mj")]) {
    assert.match(construireConfig({ VTT_ASSETS: dedans }).problemes[0], /DANS le dossier du projet/);
  }
});

test("bibliotheque d'icones rangee dans le projet : refusee, avec le conseil de la deplacer", () => {
  const config = construireConfig({ VTT_ASSETS: "/srv/Google Drive/JDR", VTT_ASSETS_ICONES: join(RACINE, "ICONS") });
  assert.equal(config.problemes.length, 1);
  assert.match(config.problemes[0], /VTT_ASSETS_ICONES=.*DANS le dossier du projet.*Deplace-le HORS du projet/);
});

test("chemin cloud valide : toutes les donnees, sauvegardes comprises, vont dedans", () => {
  const config = construireConfig({ VTT_ASSETS: "/srv/Google Drive/JDR" });
  assert.deepEqual(config.problemes, []);
  assert.equal(config.cloud, "Google Drive");
  for (const dossier of Object.values(config.dossiers)) assert.ok(dossier.startsWith("/srv/Google Drive/JDR"), dossier);
  assert.equal(config.dossiers.parties, join("/srv/Google Drive/JDR", "parties"));
});

test("chemins Windows acceptes tels qu'on les copie de l'explorateur (guillemets compris)", () => {
  for (const chemin of ["G:\\Mon Drive\\JDR", '"G:\\Mon Drive\\JDR"', "C:\\Users\\Hadrien\\OneDrive\\JDR"]) {
    assert.deepEqual(construireConfig({ VTT_ASSETS: chemin }).problemes, [], chemin);
  }
});

test("un sous-dossier deplace (VTT_ASSETS_PARTIES...) obeit aux memes regles", () => {
  const ok = construireConfig({ VTT_ASSETS: "/srv/jdr", VTT_ASSETS_CARTES: "/ssd/cartes" });
  assert.deepEqual([ok.problemes, ok.dossiers.cartes, ok.dossiers.parties], [[], "/ssd/cartes", join("/srv/jdr", "parties")]);
  const ko = construireConfig({ VTT_ASSETS: "/srv/jdr", VTT_ASSETS_PARTIES: "parties" });
  assert.match(ko.problemes[0], /VTT_ASSETS_PARTIES=parties : ce n'est pas un chemin absolu/);
});
