import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { creerDepot } from "../src/donnees/depot.js";
import { fabriquerPersonnage } from "../src/modeles/personnage.js";
import { fabriquerTable } from "../src/modeles/table.js";

const caracs = { force: 10, dexterite: 10, constitution: 10, intelligence: 10, sagesse: 10, charisme: 10 };

test("ce qui est enregistre est relu a l'identique apres un redemarrage", () => {
  const dossier = mkdtempSync(join(tmpdir(), "vtt-depot-"));
  try {
    const depot = creerDepot(dossier);
    depot.charger();
    const table = depot.enregistrerTable(fabriquerTable({ nom: "Test" }));
    const perso = depot.enregistrerPersonnage(
      fabriquerPersonnage({ nom: "Uther", classe: "paladin", caracteristiques: caracs }, { idTable: table.id, proprietaire: "A" }),
    );
    depot.vider(); // simule Ctrl + C : tout est ecrit sur le disque

    const relu = creerDepot(dossier);
    assert.deepEqual(relu.charger(), { tables: 1, personnages: 1, ignores: 0 });
    assert.deepEqual(relu.obtenirPersonnage(perso.id), perso);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("un fichier abime est ignore sans faire planter le serveur, et jamais efface", () => {
  const dossier = mkdtempSync(join(tmpdir(), "vtt-depot-"));
  try {
    const depot = creerDepot(dossier);
    depot.charger();
    const table = depot.enregistrerTable(fabriquerTable({ nom: "Test" }));
    depot.vider();
    const dossierPersos = join(dossier, table.id, "personnages");
    mkdirSync(dossierPersos, { recursive: true });
    const abime = join(dossierPersos, "p-0000000000 (conflit PC-FIXE).json");
    writeFileSync(abime, "{ pas du json");

    const bilan = creerDepot(dossier).charger();
    assert.equal(bilan.ignores, 1);
    assert.ok(existsSync(abime));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("supprimer un personnage le deplace dans la corbeille", () => {
  const dossier = mkdtempSync(join(tmpdir(), "vtt-depot-"));
  try {
    const depot = creerDepot(dossier);
    depot.charger();
    const table = depot.enregistrerTable(fabriquerTable({ nom: "Test" }));
    const perso = depot.enregistrerPersonnage(
      fabriquerPersonnage({ nom: "Arthas", classe: "paladin", caracteristiques: caracs }, { idTable: table.id, proprietaire: null }),
    );
    depot.vider();
    depot.supprimerPersonnage(perso.id);

    assert.equal(depot.obtenirPersonnage(perso.id), null);
    assert.equal(readdirSync(join(dossier, table.id, "personnages")).length, 0);
    assert.equal(readdirSync(join(dossier, table.id, "corbeille")).length, 1);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
