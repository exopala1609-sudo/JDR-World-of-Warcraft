import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { creerCompendium, installerExemples, instancierObjet } from "../src/donnees/compendium.js";
import { imageDeRemplacement } from "../src/medias.js";

function dossierTemporaire(fichiers) {
  const dossier = mkdtempSync(join(tmpdir(), "vtt-compendium-"));
  for (const [nom, contenu] of Object.entries(fichiers)) {
    mkdirSync(join(dossier, nom, ".."), { recursive: true });
    writeFileSync(join(dossier, nom), typeof contenu === "string" ? contenu : JSON.stringify(contenu));
  }
  return dossier;
}

test("les exemples du projet sont tous valides", () => {
  const rapport = creerCompendium("exemples/compendium").charger();
  assert.deepEqual(rapport.erreurs, []);
  assert.ok(rapport.objets >= 6 && rapport.sorts >= 3 && rapport.etats >= 3);
});

test("les six raretes WoW sont representees dans les objets d'exemple", () => {
  const compendium = creerCompendium("exemples/compendium");
  compendium.charger();
  const raretes = new Set(compendium.lister().objets.map((o) => o.rarete));
  assert.deepEqual([...raretes].sort(), ["classique", "epique", "inhabituel", "legendaire", "mediocre", "rare"]);
});

test("une entree fautive est signalee precisement, les autres restent disponibles", () => {
  const dossier = dossierTemporaire({
    "armes.json": {
      objets: [
        { id: "epee", nom: "Epee", type: "arme", rarete: "rare" },
        { id: "baton", nom: "Baton", type: "arme", rarete: "violette" },
        { id: "epee", nom: "Doublon", type: "arme", rarete: "rare" },
      ],
    },
    "sous-dossier/sorts.json": { sorts: [{ id: "eclair", nom: "Eclair", niveau: 3, ecole: "evocation", degats: { formule: "8d6", type: "foudre" } }] },
    "casse.json": "{ oups",
    "etats.json": { etats: [{ id: "empoisonne", nom: "Faux poison", nature: "debuff" }] },
  });
  try {
    const compendium = creerCompendium(dossier);
    const rapport = compendium.charger();
    assert.equal(rapport.objets, 1);
    assert.equal(rapport.sorts, 1); // les sous-dossiers sont lus
    assert.equal(rapport.erreurs.length, 4);
    assert.ok(rapport.erreurs.some((e) => e.fichier === "armes.json" && e.emplacement.includes("baton") && e.message.includes("Rarete")));
    assert.ok(rapport.erreurs.some((e) => e.message.includes("deja utilise")));
    assert.ok(rapport.erreurs.some((e) => e.fichier === "casse.json"));
    assert.ok(rapport.erreurs.some((e) => e.message.includes("etat officiel")));
    // L'etat officiel reste disponible, avec son identifiant visuel.
    assert.equal(compendium.obtenirDefinitionEtat("empoisonne").icone, "empoisonne");
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("un objet mis dans un sac est une copie independante, qui garde sa source", () => {
  const compendium = creerCompendium("exemples/compendium");
  compendium.charger();
  const exemplaire = instancierObjet(compendium.obtenirObjet("epee-longue"), 1);
  assert.match(exemplaire.id, /^o-[0-9a-f]{10}$/);
  assert.equal(exemplaire.source, "epee-longue");
  assert.equal(exemplaire.rarete, "classique");
});

test("les exemples ne sont installes que dans un compendium vide", () => {
  const vide = mkdtempSync(join(tmpdir(), "vtt-compendium-"));
  const rempli = dossierTemporaire({ "mes-objets.json": { objets: [] } });
  try {
    assert.ok(installerExemples(vide, "exemples/compendium").length >= 3);
    assert.deepEqual(installerExemples(rempli, "exemples/compendium"), []);
    assert.deepEqual(readdirSync(rempli), ["mes-objets.json"]);
  } finally {
    rmSync(vide, { recursive: true, force: true });
    rmSync(rempli, { recursive: true, force: true });
  }
});

test("l'image de remplacement echappe les noms dangereux", () => {
  const svg = imageDeRemplacement("cartes", "<script>alert(1)</script>");
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
});
