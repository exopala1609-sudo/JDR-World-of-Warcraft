// "npm run detecter-assets" : parcourt les emplacements cloud habituels et
// propose la ligne VTT_ASSETS a coller dans le .env. Sert surtout le jour ou
// tu installes le projet sur le deuxieme ordinateur.
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SOUS_DOSSIERS_ATTENDUS = ["cartes", "jetons", "portraits", "compendium"];
const PROFIL = homedir();

const RACINES_CANDIDATES = [
  PROFIL,
  join(PROFIL, "OneDrive"),
  join(PROFIL, "Mon Drive"),
  join(PROFIL, "My Drive"),
  join(PROFIL, "Google Drive"),
  join(PROFIL, "Dropbox"),
  join(PROFIL, "Documents"),
  ...["D", "E", "F", "G", "H"].flatMap((lettre) => [
    `${lettre}:\\`,
    `${lettre}:\\Mon Drive`,
    `${lettre}:\\My Drive`,
  ]),
];

function sousDossiers(chemin) {
  try {
    return readdirSync(chemin, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => join(chemin, e.name));
  } catch {
    return [];
  }
}

function score(chemin) {
  const contenu = sousDossiers(chemin).map((c) => c.split(/[\\/]/).pop().toLowerCase());
  return SOUS_DOSSIERS_ATTENDUS.filter((attendu) => contenu.includes(attendu)).length;
}

const trouves = [];
for (const racine of RACINES_CANDIDATES) {
  if (!existsSync(racine)) continue;
  try {
    if (!statSync(racine).isDirectory()) continue;
  } catch {
    continue;
  }
  // La racine elle-meme, puis un niveau en dessous (ex. G:\Mon Drive\JDR).
  for (const candidat of [racine, ...sousDossiers(racine)]) {
    const points = score(candidat);
    if (points >= 2) trouves.push({ candidat, points });
  }
}

trouves.sort((a, b) => b.points - a.points);

console.log("");
if (!trouves.length) {
  console.log("  Aucun dossier d'assets reconnu automatiquement.");
  console.log("  Ouvre ton dossier dans l'explorateur, copie son chemin depuis la");
  console.log("  barre d'adresse, et colle-le dans .env :  VTT_ASSETS=<ton chemin>");
} else {
  console.log("  Dossiers candidats (le plus probable en premier) :");
  for (const { candidat, points } of trouves.slice(0, 5)) {
    console.log(`    VTT_ASSETS=${candidat}      (${points}/4 sous-dossiers reconnus)`);
  }
  console.log("");
  console.log("  Copie la bonne ligne dans ton fichier .env.");
}
console.log("");
