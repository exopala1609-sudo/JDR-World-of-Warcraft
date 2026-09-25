// Lecture/ecriture des donnees de jeu.
// Regle absolue quand le dossier est synchronise dans un cloud : on n'ecrit
// jamais directement dans le fichier final. On ecrit a cote, puis on renomme
// (operation instantanee) : le cloud ne peut donc jamais synchroniser un
// fichier a moitie ecrit, et une coupure ne detruit pas la sauvegarde.
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Tous les fichiers .json d'un dossier, sous-dossiers compris, dans l'ordre
 * alphabetique. Les fichiers caches ou temporaires (".xxx", "~xxx") sont ignores.
 */
export function listerFichiersJson(dossier) {
  if (!existsSync(dossier)) return [];
  const resultat = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith(".") || entree.name.startsWith("~")) continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) resultat.push(...listerFichiersJson(chemin));
    else if (entree.isFile() && entree.name.toLowerCase().endsWith(".json")) resultat.push(chemin);
  }
  return resultat.sort();
}

/**
 * Lit un fichier JSON. Retire le "BOM" : un caractere invisible que le
 * Bloc-notes de Windows ajoute parfois en debut de fichier, et qui fait
 * echouer la lecture du JSON.
 */
export function lireTexteJson(chemin) {
  return JSON.parse(readFileSync(chemin, "utf8").replace(/^\uFEFF/, ""));
}

// --- Fichiers ecrits A LA MAIN par le MJ (referentiel, compendium) -----------
//
// Le JSON officiel n'accepte ni commentaires ni virgule en trop. Or ces
// fichiers sont faits pour etre lus et corriges dans le Bloc-notes : on
// accepte donc deux petites libertes, en plus du JSON normal :
//   - les commentaires : "// jusqu'au bout de la ligne" et "/* ... */" ;
//   - une virgule apres le dernier element d'une liste ou d'un objet.
// Les caracteres retires sont remplaces par des espaces : les numeros de
// ligne et de colonne des erreurs restent donc exacts.

/** Retire commentaires et virgules finales, sans toucher au texte entre guillemets. */
export function nettoyerJsonCommente(texte) {
  const c = texte.replace(/^﻿/, "").split("");
  const effacer = (i) => {
    if (i < c.length && c[i] !== "\n" && c[i] !== "\r") c[i] = " ";
  };
  let dansChaine = false;
  let virgule = -1; // position d'une virgule peut-etre "en trop"

  for (let i = 0; i < c.length; i++) {
    const car = c[i];
    if (dansChaine) {
      if (car === "\\") i++; // caractere echappe (\" ne ferme pas le texte)
      else if (car === '"') dansChaine = false;
      continue;
    }
    if (car === "/" && c[i + 1] === "/") {
      while (i < c.length && c[i] !== "\n") effacer(i++);
      continue;
    }
    if (car === "/" && c[i + 1] === "*") {
      while (i < c.length && !(c[i] === "*" && c[i + 1] === "/")) effacer(i++);
      effacer(i++);
      effacer(i);
      continue;
    }
    if (car === ",") {
      virgule = i;
      continue;
    }
    if ((car === "}" || car === "]") && virgule >= 0) c[virgule] = " ";
    if (car === '"') dansChaine = true;
    if (!/\s/.test(car)) virgule = -1;
  }
  return c.join("");
}

/** Ligne et colonne (a partir de 1) d'une position dans un texte. */
function ligneEtColonne(texte, position) {
  const avant = texte.slice(0, position).split("\n");
  return { ligne: avant.length, colonne: avant.at(-1).length + 1 };
}

/**
 * Lit un texte JSON commente. En cas de faute de frappe, l'erreur donne la
 * ligne et la colonne, avec un conseil en francais.
 */
export function analyserJsonCommente(texte) {
  const nettoye = nettoyerJsonCommente(texte);
  try {
    return JSON.parse(nettoye);
  } catch (erreur) {
    // Guillemets "de traitement de texte" : erreur classique apres un copier-coller.
    const courbe = nettoye.search(/[“”]/);
    const trouvee = Number(/position (\d+)/.exec(erreur.message)?.[1]);
    const position = Number.isFinite(trouvee) ? trouvee : courbe;
    if (position < 0 || position >= nettoye.trimEnd().length) {
      throw new Error(
        "Fichier incomplet ou vide : il manque une accolade } ou un crochet ] a la fin " +
          "(ou un commentaire /* n'est jamais ferme par */).",
      );
    }
    const { ligne, colonne } = ligneEtColonne(nettoye, position);
    const texteLigne = nettoye.split("\n")[ligne - 1] ?? "";
    const conseil = /[“”]/.test(texteLigne)
      ? "Remplace les guillemets courbes “ ” par des guillemets droits \"."
      : "Verifie les guillemets et les virgules sur cette ligne et sur la ligne d'avant.";
    throw new Error(`Erreur de syntaxe ligne ${ligne}, colonne ${colonne} (« ${texteLigne.trim().slice(0, 60)} »). ${conseil}`);
  }
}

export function lireJsonCommente(chemin) {
  return analyserJsonCommente(readFileSync(chemin, "utf8"));
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
