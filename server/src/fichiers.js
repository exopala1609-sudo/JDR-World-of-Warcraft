// Lecture/ecriture des donnees de jeu.
// Regle absolue quand le dossier est synchronise dans un cloud : on n'ecrit
// jamais directement dans le fichier final. On ecrit a cote, puis on renomme
// (operation instantanee) : le cloud ne peut donc jamais synchroniser un
// fichier a moitie ecrit, et une coupure ne detruit pas la sauvegarde.
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export function lireJson(chemin, valeurParDefaut = null) {
  if (!existsSync(chemin)) return valeurParDefaut;
  try {
    return JSON.parse(readFileSync(chemin, "utf8"));
  } catch (erreur) {
    console.error(`[fichiers] ${chemin} illisible : ${erreur.message}`);
    return valeurParDefaut;
  }
}

export function ecrireJsonAtomique(chemin, donnees) {
  mkdirSync(dirname(chemin), { recursive: true });
  const provisoire = `${chemin}.tmp-${process.pid}`;
  writeFileSync(provisoire, `${JSON.stringify(donnees, null, 2)}\n`, "utf8");
  renameSync(provisoire, chemin);
  return chemin;
}
