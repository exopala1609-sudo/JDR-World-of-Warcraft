import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { creerDepot } from "../src/donnees/depot.js";
import { fabriquerPersonnage } from "../src/modeles/personnage.js";
import { fabriquerTable } from "../src/modeles/table.js";
import { referentielExemple } from "./aides.js";

const referentiel = referentielExemple();

const caracs = { force: 10, dexterite: 10, constitution: 10, intelligence: 10, sagesse: 10, charisme: 10 };

test("ce qui est enregistre est relu a l'identique apres un redemarrage", () => {
  const dossier = mkdtempSync(join(tmpdir(), "vtt-depot-"));
  try {
    const depot = creerDepot(dossier);
    depot.charger();
    const table = depot.enregistrerTable(fabriquerTable({ nom: "Test" }));
    const perso = depot.enregistrerPersonnage(
      fabriquerPersonnage({ nom: "Uther", classe: "paladin", caracteristiques: caracs }, { idTable: table.id, proprietaire: "A", referentiel }),
    );
    depot.vider(); // simule Ctrl + C : tout est ecrit sur le disque

    const relu = creerDepot(dossier);
    assert.deepEqual(relu.charger(), { tables: 1, personnages: 1, combats: 0, migrees: 0, ignores: 0 });
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
      fabriquerPersonnage({ nom: "Arthas", classe: "paladin", caracteristiques: caracs }, { idTable: table.id, proprietaire: null, referentiel }),
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

test("une fiche du sprint 1 est convertie au nouveau format, sans perte", () => {
  const dossier = mkdtempSync(join(tmpdir(), "vtt-depot-"));
  try {
    const depot = creerDepot(dossier);
    depot.charger();
    const table = depot.enregistrerTable(fabriquerTable({ nom: "Test" }));
    depot.vider();
    // Une vraie fiche telle que le sprint 1 l'ecrivait (sans versionSchema).
    const ancienne = {
      id: "p-1111111111", idTable: table.id, proprietaire: "Hadrien", nom: "Thrall", classe: "barbare", niveau: 1,
      caracteristiques: { ...caracs, force: 16 }, classeArmure: 14,
      pointsDeVie: { max: 15, actuels: 9, temporaires: 0 }, desDeVie: { faces: 12, restants: 1 },
      ressources: [{ cle: "rage", nom: "Rage", actuel: 1, max: 2, recuperation: "repos-long" }],
      inventaire: [{ id: "o-2222222222", nom: "Hache", quantite: 1, rarete: "peu-commun", poids: 3, description: "" }],
      creeLe: "2026-09-24T10:00:00.000Z", modifieLe: "2026-09-24T10:00:00.000Z",
    };
    mkdirSync(join(dossier, table.id, "personnages"), { recursive: true });
    writeFileSync(join(dossier, table.id, "personnages", "p-1111111111.json"), "\uFEFF" + JSON.stringify(ancienne));

    const relu = creerDepot(dossier);
    assert.equal(relu.charger().migrees, 1);
    const fiche = relu.obtenirPersonnage("p-1111111111");
    assert.equal(fiche.versionSchema, 3); // 1 -> 2 -> 3, etape par etape
    assert.deepEqual([fiche.race, fiche.faction, fiche.portrait], [null, null, null]);
    assert.equal(fiche.pointsDeVie.actuels, 9);
    assert.deepEqual(
      { cle: fiche.ressources[0].cle, actuel: fiche.ressources[0].actuel, court: fiche.ressources[0].reposCourt, long: fiche.ressources[0].reposLong },
      { cle: "rage-barbare", actuel: 1, court: "aucun", long: "remplir" }, // libere le nom "rage" pour la jauge WoW
    );
    assert.equal(fiche.inventaire[0].rarete, "inhabituel");
    assert.deepEqual([fiche.grimoire, fiche.etats], [[], []]);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
