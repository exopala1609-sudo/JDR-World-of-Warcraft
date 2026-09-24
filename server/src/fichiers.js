// Lecture/ecriture des donnees de jeu.
// Regle absolue quand le dossier est synchronise dans un cloud : on n'ecrit
// jamais directement dans le fichier final. On ecrit a cote, puis on renomme
// (operation instantanee) : le cloud ne peut donc jamais synchroniser un
// fichier a moitie ecrit, et une coupure ne detruit pas la sauvegarde.
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Lit un fichier JSON. Retire le "BOM" : un caractere invisible que le
 * Bloc-notes de Windows ajoute parfois en debut de fichier, et qui fait
 * echouer la lecture du JSON.
 */
export function lireTexteJson(chemin) {
  return JSON.parse(readFileSync(chemin, "utf8").replace(/^\uFEFF/, ""));
}

export function lireJson(chemin, valeurParDefaut = null) {
  if (!existsSync(chemin)) return valeurParDefaut;
  try {
    return lireTexteJson(chemin);
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
