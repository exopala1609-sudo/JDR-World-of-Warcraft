// Tirage des caracteristiques aux des (4d6, on garde les 3 meilleurs).
import assert from "node:assert/strict";
import { test } from "node:test";
import { methodesDeLaTable, verifierBase } from "../../shared/creation.js";
import { appliquerTirage, autoriserRelance, FORMULE_TIRAGE, tirerCaracteristiques, totalTirage, valeursRetenues } from "../src/regles/tirage.js";
import { ErreurRegle } from "../src/regles/erreurs.js";
import { referentielExemple } from "./aides.js";

const regles = referentielExemple().reglesCreation();

test("tirage : six lancers de 4d6 en gardant les 3 meilleurs", () => {
  const formules = [];
  const desTruques = (formule) => {
    formules.push(formule);
    return { total: 12, termes: [{ jets: [6, 5, 1, 1] }] };
  };
  const tirage = tirerCaracteristiques(desTruques);
  assert.deepEqual(formules, Array(6).fill(FORMULE_TIRAGE));
  assert.deepEqual(tirage.valeurs, [12, 12, 12, 12, 12, 12]);
  assert.deepEqual(tirage.des[0], [6, 5, 1, 1]);
  // Avec les vrais des : toujours entre 3 et 18.
  for (let i = 0; i < 50; i++) assert.ok(tirerCaracteristiques().valeurs.every((v) => v >= 3 && v <= 18));
});

test("tirage : une seule fois, puis relance seulement sur accord du MJ, le meilleur total est garde", () => {
  const bon = [15, 14, 13, 12, 10, 8];
  const mauvais = [9, 9, 8, 8, 7, 6];
  let { entree, garde } = appliquerTirage(null, bon, "Thrall");
  assert.equal(garde, "nouveau");
  assert.deepEqual(valeursRetenues(entree), bon);
  assert.throws(() => appliquerTirage(entree, mauvais, "Thrall"), (e) => e instanceof ErreurRegle && /demande au MJ/.test(e.message));

  entree = autoriserRelance(entree);
  assert.throws(() => autoriserRelance(entree), /deja une relance/);
  ({ entree, garde } = appliquerTirage(entree, mauvais, "Thrall"));
  assert.equal(garde, "ancien"); // 72 contre 47 : on garde le premier
  assert.deepEqual(valeursRetenues(entree), bon);
  assert.equal(entree.tirages.length, 2);
  assert.equal(entree.relanceAutorisee, false);

  ({ entree, garde } = appliquerTirage(autoriserRelance(entree), [18, 16, 15, 14, 12, 10], "Thrall"));
  assert.equal(garde, "nouveau");
  assert.equal(totalTirage(valeursRetenues(entree)), 85);
  assert.throws(() => autoriserRelance(null), /pas encore tire/);
});

test("tirage : la repartition doit reprendre exactement les valeurs tirees", () => {
  const tirees = [17, 14, 13, 11, 9, 6];
  const base = { force: 17, dexterite: 14, constitution: 13, intelligence: 11, sagesse: 9, charisme: 6 };
  assert.equal(verifierBase("tirage-4d6", base, regles, { valeursTirage: tirees }), null);
  assert.match(verifierBase("tirage-4d6", { ...base, force: 18 }, regles, { valeursTirage: tirees }), /valeurs de ton tirage \(17, 14, 13, 11, 9, 6\)/);
  assert.match(verifierBase("tirage-4d6", base, regles), /Lance d'abord les des/);
});

test("methodes de la table : le MJ en retire, jamais au-dela du referentiel", () => {
  assert.deepEqual(methodesDeLaTable(regles, { methodes: null }), ["tableau-standard", "achat-de-points", "tirage-4d6"]);
  assert.deepEqual(methodesDeLaTable(regles, { methodes: ["tirage-4d6"] }), ["tirage-4d6"]);
  assert.deepEqual(methodesDeLaTable({ ...regles, methodes: ["tableau-standard"] }, { methodes: ["tirage-4d6"] }), ["tableau-standard"]);
  const standard = { force: 15, dexterite: 14, constitution: 13, intelligence: 12, sagesse: 10, charisme: 8 };
  assert.match(verifierBase("tableau-standard", standard, regles, { methodes: ["tirage-4d6"] }), /n'a pas permis/);
});
