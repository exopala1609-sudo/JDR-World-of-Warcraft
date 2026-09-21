// Cree config.json a partir de config.example.json au premier lancement,
// pour que le MJ n'ait qu'un seul fichier a editer (ses chemins Windows).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cible = resolve(racine, "config.json");

if (!existsSync(cible)) {
  copyFileSync(resolve(racine, "config.example.json"), cible);
  console.log("[config] config.json cree. Ouvre-le pour y mettre tes dossiers Windows.");
}

for (const sous of ["cartes", "jetons", "portraits", "compendium"]) {
  mkdirSync(resolve(racine, "donnees-mj", sous), { recursive: true });
}
