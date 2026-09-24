// Lance apres "npm install" : cree le .env du poste et les dossiers de travail.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = resolve(racine, ".env");

if (!existsSync(env)) {
  copyFileSync(resolve(racine, ".env.exemple"), env);
  console.log("");
  console.log("  Fichier .env cree pour ce poste.");
  console.log("  Ouvre-le et renseigne VTT_ASSETS (le chemin de ton dossier cloud).");
  console.log("  Besoin d'aide ? lance : npm run detecter-assets");
  console.log("");
} else {
  console.log("[env] .env deja present : conserve tel quel.");
}

// Dossiers de secours, utilises tant que VTT_ASSETS pointe dans le projet.
for (const sous of ["cartes", "jetons", "portraits", "icones", "polices", "compendium", "parties"]) {
  mkdirSync(resolve(racine, "donnees-mj", sous), { recursive: true });
}
