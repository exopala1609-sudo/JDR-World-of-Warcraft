// Lance apres "npm install" : cree le .env du poste et les dossiers de travail.
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = resolve(racine, ".env");

if (!existsSync(env)) {
  copyFileSync(resolve(racine, ".env.exemple"), env);
  console.log("");
  console.log("  Fichier .env cree pour ce poste.");
  console.log("  !! A FAIRE avant de lancer le serveur : ouvre-le et renseigne VTT_ASSETS,");
  console.log("     le chemin COMPLET de ton dossier cloud (ex. G:\\Mon Drive\\JDR).");
  console.log("     Sans lui, le serveur refuse de demarrer (pour ne rien sauvegarder au mauvais endroit).");
  console.log("  Besoin d'aide ? lance : npm run detecter-assets");
  console.log("");
} else {
  console.log("[env] .env deja present : conserve tel quel.");
}

// Plus de "dossier de secours" dans le projet : toutes les donnees vivent dans
// le dossier cloud indique par VTT_ASSETS (voir docs/CONFIGURATION.md).
