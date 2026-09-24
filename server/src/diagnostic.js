// Verification des dossiers au demarrage : sur deux PC differents, la panne
// numero un sera "le chemin du .env ne correspond pas a ce poste".
// Mieux vaut un message clair tout de suite qu'une carte qui ne charge pas.
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES } from "./config.js";

/**
 * Premier lancement sur un dossier cloud neuf : on cree les sous-dossiers
 * attendus (cartes, jetons...). Mais UNIQUEMENT si le dossier racine existe
 * deja : si le chemin du .env contient une faute de frappe, on ne veut surtout
 * pas fabriquer une arborescence au mauvais endroit.
 */
export function creerSousDossiersManquants(config) {
  if (!existsSync(config.racineAssets)) return [];
  const crees = [];
  for (const categorie of Object.keys(CATEGORIES)) {
    const chemin = config.dossiers[categorie];
    const dansLaRacine = chemin === join(config.racineAssets, categorie);
    if (dansLaRacine && !existsSync(chemin)) {
      mkdirSync(chemin, { recursive: true });
      crees.push(categorie);
    }
  }
  return crees;
}

export function diagnostiquerDossiers(config) {
  return Object.keys(CATEGORIES).map((categorie) => {
    const chemin = config.dossiers[categorie];

    if (!existsSync(chemin)) {
      return { categorie, chemin, etat: "absent", nbFichiers: 0 };
    }
    if (!statSync(chemin).isDirectory()) {
      return { categorie, chemin, etat: "pas-un-dossier", nbFichiers: 0 };
    }

    try {
      const nbFichiers = readdirSync(chemin).filter((n) => !n.startsWith(".")).length;
      return { categorie, chemin, etat: nbFichiers ? "ok" : "vide", nbFichiers };
    } catch (erreur) {
      return { categorie, chemin, etat: "illisible", nbFichiers: 0, message: erreur.message };
    }
  });
}

const SYMBOLES = {
  ok: "[ OK ]",
  vide: "[VIDE]",
  absent: "[ ?? ]",
  "pas-un-dossier": "[ ?? ]",
  illisible: "[ !! ]",
};

export function afficherDiagnostic(config, rapport) {
  console.log(`  Poste           : ${config.nomDuPoste}`);
  console.log(`  Dossier assets  : ${config.racineAssets}${config.cloud ? `  (${config.cloud})` : ""}`);

  for (const ligne of rapport) {
    const detail =
      ligne.etat === "ok"
        ? `${ligne.nbFichiers} element(s)`
        : ligne.etat === "vide"
          ? "dossier vide"
          : ligne.etat === "illisible"
            ? `illisible : ${ligne.message}`
            : "INTROUVABLE";
    console.log(`  ${SYMBOLES[ligne.etat]} ${ligne.categorie.padEnd(11)} ${detail}`);
  }

  const manquants = rapport.filter((l) => l.etat === "absent" || l.etat === "pas-un-dossier");
  if (manquants.length) {
    console.log("");
    console.log("  !! Des dossiers sont introuvables sur ce poste.");
    console.log(`     Verifie VTT_ASSETS dans le fichier .env (valeur actuelle : ${config.racineAssets})`);
    console.log("     ou lance : npm run detecter-assets");
  }

  if (config.cloud) {
    console.log("");
    console.log(`  Note ${config.cloud} : fais un clic droit sur le dossier et choisis`);
    console.log("  \"Toujours conserver sur cet appareil\" / \"Disponible hors connexion\".");
    console.log("  Sinon les fichiers ne sont que des raccourcis et les cartes mettront");
    console.log("  plusieurs secondes a s'afficher en pleine partie.");
  }
  console.log("");
}
