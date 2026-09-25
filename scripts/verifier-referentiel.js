// "npm run verifier-referentiel" : relit les fichiers du referentiel (races,
// classes...) et affiche les erreurs, SANS lancer le serveur.
// A utiliser apres chaque modification faite au Bloc-notes.
//
//   npm run verifier-referentiel                  -> le dossier du .env
//   npm run verifier-referentiel -- "D:\Essais"   -> un autre dossier
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chargerConfig } from "../server/src/config.js";
import { creerReferentiel, resumerReferentiel, situerErreur } from "../server/src/donnees/referentiel.js";

const dossier = process.argv[2] ? resolve(process.argv[2]) : chargerConfig().dossiers.referentiel;

console.log("");
console.log(`  Dossier verifie : ${dossier}`);
if (!existsSync(dossier)) {
  console.log("  !! Dossier introuvable. Verifie VTT_ASSETS dans le fichier .env");
  console.log("     (le dossier est cree et rempli au premier lancement du serveur).\n");
  process.exit(1);
}

const referentiel = creerReferentiel(dossier);
const rapport = referentiel.charger();
console.log(`  Contenu lu      : ${resumerReferentiel(rapport)}.`);

const { factions, races, classes } = referentiel.lister();
for (const faction of factions) {
  const peuples = races.filter((r) => r.factions.includes(faction.id)).map((r) => r.nom);
  console.log(`    ${faction.nom.padEnd(12)} ${peuples.join(", ") || "(aucune race)"}`);
}
console.log(`    ${"Classes".padEnd(12)} ${classes.map((c) => c.nom).join(", ") || "(aucune)"}`);

console.log("");
if (!rapport.erreurs.length) {
  console.log("  [ OK ] Aucune erreur.\n");
} else {
  console.log(`  !! ${rapport.erreurs.length} erreur(s) :`);
  for (const erreur of rapport.erreurs) {
    console.log(`     - ${situerErreur(erreur)} :`);
    console.log(`       ${erreur.message}`);
  }
  console.log("\n  Les entrees en erreur sont ignorees ; le reste fonctionne.\n");
  process.exitCode = 1;
}
