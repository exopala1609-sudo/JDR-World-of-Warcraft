// Outils communs aux tests (ce fichier n'est pas lui-meme un test).
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerReferentiel } from "../src/donnees/referentiel.js";
import { lireJsonCommente } from "../src/fichiers.js";

/** Le referentiel d'exemple du projet (races, classes... provisoires). */
export function referentielExemple() {
  const referentiel = creerReferentiel("exemples/referentiel");
  referentiel.charger();
  return referentiel;
}

/**
 * Les exemples du projet, plus de quoi tester les regles du livre sans en
 * recopier le texte : un Dracthyr et un Pandaren minimalistes (inventes), la
 * restriction de lore de l'Evocateur, et un don reserve aux elfes.
 */
export function referentielSimule() {
  const dossier = mkdtempSync(join(tmpdir(), "vtt-referentiel-"));
  cpSync("exemples/referentiel", dossier, { recursive: true });
  const classes = lireJsonCommente(join(dossier, "classes.json"));
  const evocateur = classes.classes.find((c) => c.id === "evocateur");
  evocateur.restrictionLore = { peuples: [{ race: "dracthyr" }], message: "Lore : les evocateurs sont des dracthyrs." };
  const chasseur = classes.classes.find((c) => c.id === "chasseur-de-demons");
  chasseur.restrictionLore = { peuples: [{ race: "elfe", choix: ["drow"] }], message: "Lore : elfes seulement." };
  writeFileSync(join(dossier, "classes.json"), JSON.stringify(classes));
  writeFileSync(
    join(dossier, "test-livre.json"),
    JSON.stringify({
      races: [
        { id: "dracthyr", nom: "Dracthyr", factions: ["alliance", "horde"], typeCreature: "Dragon" },
        {
          id: "pandaren",
          nom: "Pandaren",
          factions: ["alliance", "horde"],
          options: [
            {
              id: "philosophie",
              nom: "Philosophie",
              choix: [
                { id: "huojin", nom: "Huojin", factions: ["horde"], renommee: { faction: "Horde", valeur: 3 } },
                { id: "tushui", nom: "Tushui", factions: ["alliance"], renommee: { faction: "Alliance", valeur: 3 } },
              ],
            },
          ],
        },
      ],
      dons: [{ id: "don-des-elfes", nom: "Don des elfes", categorie: "origine", races: ["elfe"] }],
    }),
  );
  const referentiel = creerReferentiel(dossier);
  const rapport = referentiel.charger();
  rmSync(dossier, { recursive: true, force: true });
  if (rapport.erreurs.length) throw new Error(JSON.stringify(rapport.erreurs));
  return referentiel;
}
