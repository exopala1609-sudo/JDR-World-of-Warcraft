// Copies de secours et fichiers abimes : rien ne doit jamais se perdre.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { creerDepot } from "../src/donnees/depot.js";
import { creerCopie, listerCopies, nomDeCopie, restaurerCopie } from "../src/donnees/sauvegardes.js";
import { fabriquerTable } from "../src/modeles/table.js";

/** Un dossier de jeu jetable : parties/ et sauvegardes/, supprime apres le test. */
function avecDossier(essai) {
  const racine = mkdtempSync(join(tmpdir(), "vtt-sauvegardes-"));
  try {
    essai({ parties: join(racine, "parties"), sauvegardes: join(racine, "sauvegardes") });
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

function tableEnregistree(parties, nom = "Test") {
  const depot = creerDepot(parties);
  depot.charger();
  const table = depot.enregistrerTable(fabriquerTable({ nom }));
  depot.vider();
  return { depot, table };
}

test("le nom d'une copie donne sa date, sans caractere interdit sous Windows", () => {
  assert.equal(nomDeCopie(new Date(2026, 10, 25, 20, 5, 33), "demarrage"), "2026-11-25_20h05m33_demarrage");
});

test("une copie contient les tables, mais ni le verrou ni les fichiers temporaires", () => {
  avecDossier(({ parties, sauvegardes }) => {
    const { table } = tableEnregistree(parties);
    writeFileSync(join(parties, "partie-en-cours.verrou.json"), "{}");
    writeFileSync(join(parties, table.id, "scene.json.tmp-1234"), "a moitie");

    const nom = creerCopie(parties, sauvegardes, "demarrage");
    assert.deepEqual(readdirSync(join(sauvegardes, nom)), [table.id]);
    assert.ok(existsSync(join(sauvegardes, nom, table.id, "table.json")));
    assert.ok(!existsSync(join(sauvegardes, nom, table.id, "scene.json.tmp-1234")));
  });
});

test("sans aucune table, aucune copie vide n'est creee", () => {
  avecDossier(({ parties, sauvegardes }) => {
    mkdirSync(parties, { recursive: true });
    assert.equal(creerCopie(parties, sauvegardes, "demarrage"), null);
    assert.ok(!existsSync(sauvegardes));
  });
});

test("seules les copies les plus recentes sont gardees, et un dossier range a la main est respecte", () => {
  avecDossier(({ parties, sauvegardes }) => {
    tableEnregistree(parties);
    mkdirSync(join(sauvegardes, "mes-archives"), { recursive: true });
    for (let jour = 1; jour <= 5; jour++) creerCopie(parties, sauvegardes, "en-jeu", { maintenant: new Date(2026, 10, jour, 20), garder: 3 });

    assert.deepEqual(
      listerCopies(sauvegardes).map((c) => c.nom),
      ["2026-11-05_20h00m00_en-jeu", "2026-11-04_20h00m00_en-jeu", "2026-11-03_20h00m00_en-jeu"],
    );
    assert.ok(existsSync(join(sauvegardes, "mes-archives")));
  });
});

test("restaurer remet les tables dans l'etat de la copie, y compris en retirant une table creee apres", () => {
  avecDossier(({ parties, sauvegardes }) => {
    const { depot, table } = tableEnregistree(parties, "Avant");
    const nom = creerCopie(parties, sauvegardes, "demarrage");
    depot.enregistrerTable({ ...table, nom: "Apres" });
    const nouvelle = depot.enregistrerTable(fabriquerTable({ nom: "Nouvelle" }));
    depot.vider();

    restaurerCopie(parties, join(sauvegardes, nom));
    const relu = creerDepot(parties);
    assert.equal(relu.charger().tables, 1);
    assert.equal(relu.obtenirTable(table.id).nom, "Avant");
    assert.equal(relu.obtenirTable(nouvelle.id), null);
  });
});

test("une scene illisible est mise de cote au lieu d'etre ecrasee, et le MJ est prevenu", () => {
  avecDossier(({ parties }) => {
    const { table } = tableEnregistree(parties);
    const scene = join(parties, table.id, "scene.json");
    writeFileSync(scene, '{ "idTable": "' + table.id + '", la suite est perdue');

    const depot = creerDepot(parties);
    assert.equal(depot.charger().ignores, 1);
    // La premiere modification en jeu ecrit une scene neuve...
    depot.enregistrerScene(depot.obtenirScene(table.id));
    depot.vider();
    // ... mais l'ancienne est intacte dans abimes/.
    const abimes = readdirSync(join(parties, table.id, "abimes"));
    assert.equal(abimes.length, 1);
    assert.match(readFileSync(join(parties, table.id, "abimes", abimes[0]), "utf8"), /la suite est perdue/);
    assert.equal(depot.alertes(table.id).length, 1);
    assert.match(depot.alertes(table.id)[0], /mis de cote/);
    assert.deepEqual(depot.alertes("t-0000000000"), []); // une autre table n'est pas concernee
  });
});

test("au lancement suivant, le MJ est encore prevenu tant que le dossier abimes/ n'est pas vide", () => {
  avecDossier(({ parties }) => {
    const { table } = tableEnregistree(parties);
    writeFileSync(join(parties, table.id, "notes.json"), "pas du json");
    creerDepot(parties).charger(); // met de cote

    const suivant = creerDepot(parties);
    assert.equal(suivant.charger().ignores, 0); // rien de NOUVEAU d'abime
    assert.match(suivant.alertes(table.id)[0], /1 fichier\(s\) abime\(s\) attendent/);

    rmSync(join(parties, table.id, "abimes"), { recursive: true });
    const apres = creerDepot(parties);
    apres.charger();
    assert.deepEqual(apres.alertes(table.id), []);
  });
});

test("des quetes d'un format inattendu sont aussi mises de cote", () => {
  avecDossier(({ parties }) => {
    const { table } = tableEnregistree(parties);
    writeFileSync(join(parties, table.id, "quetes.json"), JSON.stringify({ idTable: table.id, quetes: [{ titre: 42 }] }));

    const depot = creerDepot(parties);
    depot.charger();
    assert.ok(!existsSync(join(parties, table.id, "quetes.json")));
    assert.equal(readdirSync(join(parties, table.id, "abimes")).length, 1);
    assert.deepEqual(depot.obtenirQuetes(table.id), []);
  });
});

test("une modification fait avancer le compteur qui declenche les copies horaires", () => {
  avecDossier(({ parties }) => {
    const { table } = tableEnregistree(parties);
    const depot = creerDepot(parties);
    depot.charger();
    const avant = depot.compteurModifications();
    depot.enregistrerTable({ ...table, nom: "Renommee" });
    assert.ok(depot.compteurModifications() > avant);
    depot.vider();
  });
});
