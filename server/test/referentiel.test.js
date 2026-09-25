import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CLASSES } from "../../shared/dnd5e.js";
import { creerReferentiel, installerExemplesReferentiel, situerErreur } from "../src/donnees/referentiel.js";
import { analyserJsonCommente } from "../src/fichiers.js";
import { REGLES_CREATION_PAR_DEFAUT } from "../src/modeles/referentiel.js";

const EXEMPLES = "exemples/referentiel";

function dossierTemporaire(fichiers) {
  const dossier = mkdtempSync(join(tmpdir(), "vtt-referentiel-"));
  for (const [nom, contenu] of Object.entries(fichiers)) {
    mkdirSync(join(dossier, nom, ".."), { recursive: true });
    writeFileSync(join(dossier, nom), typeof contenu === "string" ? contenu : JSON.stringify(contenu));
  }
  return dossier;
}

function avecDossier(fichiers, verifier) {
  const dossier = dossierTemporaire(fichiers);
  try {
    verifier(dossier);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

// Un petit referentiel minimal et valide, a completer dans chaque test.
const BASE = {
  factions: [{ id: "alliance", nom: "Alliance" }, { id: "horde", nom: "Horde" }],
  classes: [{ id: "guerrier", nom: "Guerrier", deDeVie: 10 }, { id: "mage", nom: "Mage", deDeVie: 6 }],
  ressources: [{ id: "mana", nom: "Mana", type: "jauge", max: 100, reposCourt: "moitie", reposLong: "remplir" }],
};

// --- JSON commente ----------------------------------------------------------------

test("JSON commente : commentaires et virgules finales acceptes, textes intacts", () => {
  const texte = `\uFEFF// en-tete
{
  "lien": "http://exemple//pas-un-commentaire", /* bloc */
  "citation": "il a dit \\"// bonjour\\"",
  "liste": [1, 2, 3,], // virgule en trop
}`;
  assert.deepEqual(analyserJsonCommente(texte), {
    lien: "http://exemple//pas-un-commentaire",
    citation: 'il a dit "// bonjour"',
    liste: [1, 2, 3],
  });
});

test("JSON commente : une faute de frappe donne la ligne et un conseil en francais", () => {
  assert.throws(() => analyserJsonCommente('{\n  "a": 1\n  "b": 2\n}'), /ligne 3, colonne 3.*virgules/);
  assert.throws(() => analyserJsonCommente('{\n  "a": “texte” \n}'), /ligne 2.*guillemets courbes/);
  assert.throws(() => analyserJsonCommente('{ "a": [1, 2'), /incomplet/);
  assert.throws(() => analyserJsonCommente(""), /incomplet ou vide/);
});

// --- Les exemples fournis -------------------------------------------------------------

test("les exemples du referentiel sont tous valides", () => {
  const rapport = creerReferentiel(EXEMPLES).charger();
  assert.deepEqual(rapport.erreurs, []);
  assert.equal(rapport.factions, 2);
  assert.equal(rapport.races, 14);
  assert.equal(rapport.classes, 16);
  assert.ok(rapport.creationPersonnalisee);
});

test("les 12 classes deja utilisees par les fiches existent toujours, avec le meme de de vie", () => {
  const referentiel = creerReferentiel(EXEMPLES);
  referentiel.charger();
  for (const [id, { deDeVie }] of Object.entries(CLASSES)) {
    assert.equal(referentiel.obtenirClasse(id)?.deDeVie, deDeVie, `classe ${id}`);
  }
  // Les 4 classes propres a WoW
  for (const id of ["chaman", "chasseur-de-demons", "chevalier-de-la-mort", "evocateur"]) {
    assert.ok(referentiel.obtenirClasse(id), `classe ${id}`);
  }
  // Nom WoW, cle D&D conservee
  assert.equal(referentiel.obtenirClasse("roublard").nom, "Voleur");
});

test("les regles de creation d'exemple sont les regles officielles", () => {
  const referentiel = creerReferentiel(EXEMPLES);
  referentiel.charger();
  assert.deepEqual(referentiel.reglesCreation(), REGLES_CREATION_PAR_DEFAUT);
});

test("restrictions race / classe issues des donnees", () => {
  const referentiel = creerReferentiel(EXEMPLES);
  referentiel.charger();
  assert.ok(referentiel.combinaisonPermise("dracthyr", "evocateur"));
  assert.ok(!referentiel.combinaisonPermise("humain", "evocateur"));
  assert.ok(referentiel.combinaisonPermise("elfe-de-sang", "chasseur-de-demons"));
  assert.ok(!referentiel.combinaisonPermise("nain", "chasseur-de-demons"));
  assert.ok(!referentiel.combinaisonPermise("humain", "classe-inconnue"));
  assert.ok(!referentiel.combinaisonPermise("race-inconnue", "guerrier"));
  // Chaque race propose au moins une classe, et l'affichage recoit la liste.
  for (const race of referentiel.lister().races) assert.ok(race.classesPermises.length > 0, race.id);
});

test("desactiver les restrictions ouvre toutes les classes a toutes les races", () => {
  avecDossier(
    {
      "base.json": BASE,
      "races.json": { races: [{ id: "orc", nom: "Orc", factions: ["horde"], classesAutorisees: ["guerrier"] }] },
      "creation.json": { creation: { restrictionsRaceClasse: false } },
    },
    (dossier) => {
      const referentiel = creerReferentiel(dossier);
      assert.deepEqual(referentiel.charger().erreurs, []);
      assert.ok(referentiel.combinaisonPermise("orc", "mage"));
      assert.deepEqual(referentiel.lister().races[0].classesPermises, ["guerrier", "mage"]);
    },
  );
});

test("valeurs par defaut : icones, vitesse, taille", () => {
  avecDossier(
    { "base.json": { ...BASE, races: [{ id: "gnome", nom: "Gnome", factions: ["alliance"] }] } },
    (dossier) => {
      const referentiel = creerReferentiel(dossier);
      referentiel.charger();
      const { factions, races, classes } = referentiel.lister();
      assert.equal(factions[0].embleme, "faction-alliance");
      assert.equal(races[0].icone, "race-gnome");
      assert.equal(classes[0].icone, "classe-guerrier");
      assert.equal(races[0].vitesse, 9);
      assert.equal(races[0].taille, "moyenne");
      assert.equal(races[0].classesAutorisees, "toutes");
    },
  );
});

// --- Erreurs de saisie ------------------------------------------------------------------

test("une entree fautive est signalee precisement, les autres restent disponibles", () => {
  avecDossier(
    {
      "base.json": BASE,
      "races.json": `{
        // commentaire accepte
        "races": [
          { "id": "nain", "nom": "Nain", "factions": ["alliance"], "vitesse": 7.5 },
          { "id": "troll", "nom": "Troll", "factions": ["horde"], "bonusCaracteristiques": { "agilite": 2 } },
          { "id": "Orc Majuscule", "nom": "Orc", "factions": ["horde"] },
          { "id": "nain", "nom": "Doublon", "factions": ["alliance"] },
          { "id": "gobelin", "nom": "Gobelin", "factions": ["horde"], "vitesse": 8 },
        ],
      }`,
      "casse.json": '{ "classes": [ { "id": "x" } ',
      "inconnu.json": { monstres: [] },
    },
    (dossier) => {
      const referentiel = creerReferentiel(dossier);
      const rapport = referentiel.charger();
      assert.equal(rapport.races, 1);
      const trouver = (texte) => rapport.erreurs.find((e) => `${e.fichier} ${e.emplacement} ${e.message}`.includes(texte));
      assert.ok(trouver("races[1] (troll)"), "caracteristique inconnue");
      assert.ok(trouver("minuscules, chiffres et tirets"), "identifiant invalide");
      assert.ok(trouver("deja utilise"), "doublon");
      assert.ok(trouver("pas de 1,5 m"), "vitesse");
      assert.ok(trouver("casse.json fichier Fichier incomplet"), "JSON illisible");
      assert.ok(trouver("Section inconnue"), "section inconnue");
      assert.equal(referentiel.obtenirRace("nain").nom, "Nain");
    },
  );
});

test("les liens casses entre sections sont signales et neutralises", () => {
  avecDossier(
    {
      "base.json": {
        ...BASE,
        classes: [
          ...BASE.classes,
          { id: "moine", nom: "Moine", deDeVie: 8, ressources: [{ ressource: "mana" }, { ressource: "chi" }] },
        ],
      },
      "races.json": {
        races: [
          { id: "pandaren", nom: "Pandaren", factions: ["alliance", "neutre"], classesAutorisees: ["moine", "moines"] },
          { id: "naga", nom: "Naga", factions: ["neutre"] },
        ],
      },
    },
    (dossier) => {
      const referentiel = creerReferentiel(dossier);
      const { erreurs } = referentiel.charger();
      const messages = erreurs.map((e) => `${e.emplacement} : ${e.message}`);
      assert.ok(messages.some((m) => m.includes("pandaren") && m.includes("Faction inconnue : neutre")));
      assert.ok(messages.some((m) => m.includes("naga") && m.includes("race ignoree")));
      assert.ok(messages.some((m) => m.includes("pandaren") && m.includes("moines")));
      assert.ok(messages.some((m) => m.includes("moine") && m.includes("Ressource inconnue : chi")));
      // Ce qui reste est coherent et utilisable.
      assert.deepEqual(referentiel.obtenirRace("pandaren").factions, ["alliance"]);
      assert.deepEqual(referentiel.obtenirRace("pandaren").classesAutorisees, ["moine"]);
      assert.equal(referentiel.obtenirRace("naga"), null);
      assert.deepEqual(referentiel.obtenirClasse("moine").ressources, [{ ressource: "mana" }]);
    },
  );
});

test("une seule faute de frappe ne provoque pas une cascade de messages", () => {
  const races = {
    races: [
      { id: "orc", nom: "Orc", factions: ["horde"], classesAutorisees: ["guerrier", "mage"] },
      { id: "troll", nom: "Troll", factions: ["horde"], classesAutorisees: ["guerrier", "mage", "druide"] },
    ],
  };
  // La classe "mage" est fautive (de de vie 7) : seule SA faute est signalee.
  const classes = [BASE.classes[0], { id: "mage", nom: "Mage", deDeVie: 7 }];
  avecDossier({ "base.json": { ...BASE, classes }, "races.json": races }, (dossier) => {
    const referentiel = creerReferentiel(dossier);
    const { erreurs } = referentiel.charger();
    assert.deepEqual(
      erreurs.map((e) => e.emplacement),
      ["classes[1] (mage)", "races (troll)"], // "druide" n'existe vraiment pas
    );
    assert.deepEqual(referentiel.obtenirRace("orc").classesAutorisees, ["guerrier"]);
  });
  // Un fichier de factions illisible : une erreur de syntaxe, pas 2 races "sans faction".
  avecDossier(
    {
      "base.json": { classes: BASE.classes },
      "factions.json": '{ "factions": [ { "id": "horde", "nom": "Horde" } ',
      "races.json": races,
    },
    (dossier) => {
      const { erreurs } = creerReferentiel(dossier).charger();
      assert.deepEqual(
        erreurs.map(situerErreur),
        ["referentiel/factions.json > fichier", "referentiel > factions", "referentiel > races"],
      );
    },
  );
});

test("regles de creation : valeurs verifiees, une seule definition, officielles par defaut", () => {
  avecDossier(
    {
      "a.json": { creation: { tableauStandard: [15, 14, 13], achatDePoints: { budget: 27, couts: { 8: 0, 10: 2 } } } },
      "b.json": { creation: { caracteristiqueMaximale: 18 } },
      "c.json": { creation: { caracteristiqueMaximale: 22 } },
    },
    (dossier) => {
      const referentiel = creerReferentiel(dossier);
      const { erreurs, creationPersonnalisee } = referentiel.charger();
      const surCreation = erreurs.filter((e) => e.emplacement === "creation");
      assert.ok(surCreation.some((e) => e.fichier === "a.json" && e.message.includes("exactement 6")));
      assert.ok(surCreation.some((e) => e.fichier === "a.json" && e.message.includes("sans trou")));
      assert.ok(surCreation.some((e) => e.fichier === "c.json" && e.message.includes("Deja definie dans b.json")));
      assert.ok(creationPersonnalisee);
      assert.equal(referentiel.reglesCreation().caracteristiqueMaximale, 18);
      assert.equal(referentiel.reglesCreation().achatDePoints.budget, 27);
    },
  );
});

test("referentiel vide : creation impossible signalee, regles officielles par defaut", () => {
  avecDossier({}, (dossier) => {
    const referentiel = creerReferentiel(dossier);
    const rapport = referentiel.charger();
    assert.deepEqual(
      rapport.erreurs.map((e) => e.emplacement),
      ["factions", "races", "classes"],
    );
    assert.equal(rapport.creationPersonnalisee, false);
    assert.deepEqual(referentiel.reglesCreation(), REGLES_CREATION_PAR_DEFAUT);
  });
});

test("un rechargement prend en compte les fichiers modifies", () => {
  avecDossier({ "base.json": BASE }, (dossier) => {
    const referentiel = creerReferentiel(dossier);
    referentiel.charger();
    assert.equal(referentiel.obtenirClasse("mage").deDeVie, 6);
    const classes = BASE.classes.map((c) => (c.id === "mage" ? { ...c, nom: "Arcaniste", deDeVie: 8 } : c));
    writeFileSync(join(dossier, "base.json"), JSON.stringify({ ...BASE, classes }));
    referentiel.charger();
    assert.equal(referentiel.obtenirClasse("mage").nom, "Arcaniste");
    assert.equal(referentiel.obtenirClasse("mage").deDeVie, 8);
  });
});

test("les exemples ne sont installes que dans un referentiel vide, mode d'emploi compris", () => {
  const vide = mkdtempSync(join(tmpdir(), "vtt-referentiel-"));
  const rempli = dossierTemporaire({ "mes-races.json": { races: [] } });
  try {
    const copies = installerExemplesReferentiel(vide, EXEMPLES);
    assert.ok(copies.includes("races.json") && copies.includes("LISEZ-MOI.txt"));
    assert.deepEqual(installerExemplesReferentiel(rempli, EXEMPLES), []);
    assert.deepEqual(readdirSync(rempli), ["mes-races.json"]);
    // Un dossier absent (chemin du .env faux) n'est jamais cree.
    assert.deepEqual(installerExemplesReferentiel(join(vide, "absent"), EXEMPLES), []);
  } finally {
    rmSync(vide, { recursive: true, force: true });
    rmSync(rempli, { recursive: true, force: true });
  }
});
