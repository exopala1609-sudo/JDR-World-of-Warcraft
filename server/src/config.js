// Configuration du poste courant, lue dans le fichier .env a la racine.
// Un .env par ordinateur : c'est ce qui permet de passer du PC fixe au
// portable en ne changeant qu'une seule ligne (VTT_ASSETS).
import { existsSync, readdirSync } from "node:fs";
import { hostname } from "node:os";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, posix, relative, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Sous-dossiers attendus dans le dossier d'assets, et leur variable d'override.
export const CATEGORIES = /** @type {const} */ ({
  cartes: "VTT_ASSETS_CARTES",
  jetons: "VTT_ASSETS_JETONS",
  portraits: "VTT_ASSETS_PORTRAITS",
  icones: "VTT_ASSETS_ICONES",
  polices: "VTT_ASSETS_POLICES",
  sons: "VTT_ASSETS_SONS",
  compendium: "VTT_ASSETS_COMPENDIUM",
  referentiel: "VTT_ASSETS_REFERENTIEL",
  parties: "VTT_ASSETS_PARTIES",
});

// Categories exposees telles quelles aux navigateurs. Le compendium et les
// sauvegardes passeront par l'API (le MJ decide ce que les joueurs voient).
export const CATEGORIES_PUBLIQUES = ["jetons", "portraits", "cartes", "icones", "polices", "sons"];

const CLOUDS_CONNUS = [
  { motif: /onedrive/i, nom: "OneDrive" },
  { motif: /google ?drive|mon drive|my drive/i, nom: "Google Drive" },
  { motif: /dropbox/i, nom: "Dropbox" },
  { motif: /icloud/i, nom: "iCloud" },
];

function chargerFichierEnv() {
  const fichier = resolve(RACINE, ".env");
  if (!existsSync(fichier)) {
    console.warn("[config] Aucun fichier .env : copie .env.exemple en .env pour configurer ce poste.");
    return false;
  }
  try {
    // Node sait lire un .env nativement depuis la v20.12 : aucune dependance.
    process.loadEnvFile(fichier);
    return true;
  } catch (erreur) {
    console.error("[config] .env illisible :", erreur.message);
    return false;
  }
}

/** Nettoie une valeur de .env : guillemets, espaces. Renvoie null si vide. */
function brutDe(valeur) {
  if (typeof valeur !== "string") return null;
  const brut = valeur.trim().replace(/^["']|["']$/g, "").trim();
  return brut || null;
}

/** Chemin absolu ? (Windows "G:\...", "\\serveur\...", ou Linux/Mac "/...", "~/...") */
const estAbsolu = (brut) => brut.startsWith("~") || win32.isAbsolute(brut) || posix.isAbsolute(brut);

function developper(brut) {
  return brut.startsWith("~") ? join(homedir(), brut.slice(1)) : brut;
}

/** Ce chemin est-il DANS le dossier du projet (donc pas synchronise par le cloud) ? */
function dansLeProjet(chemin) {
  // Un chemin d'un autre systeme (G:\... vu depuis Linux) ne peut pas etre dans le projet.
  if (!isAbsolute(chemin)) return false;
  const relatif = relative(RACINE, chemin);
  return relatif === "" || (!relatif.startsWith("..") && !isAbsolute(relatif));
}

export function detecterCloud(chemin) {
  return CLOUDS_CONNUS.find(({ motif }) => motif.test(chemin))?.nom ?? null;
}

/**
 * Construit la configuration a partir des variables d'environnement (fonction
 * PURE : testable sans fichier). "problemes" liste ce qui empeche de demarrer.
 *
 * REGLE : les donnees de jeu (parties, personnages...) ne vivent JAMAIS dans
 * le dossier du projet. Elles vont exclusivement dans le dossier indique par
 * VTT_ASSETS, un chemin ABSOLU vers ton dossier cloud. Sans lui, le serveur
 * refuse de demarrer : mieux vaut un message clair qu'une partie sauvegardee
 * sur un seul PC, que l'autre ne verra jamais.
 */
export function construireConfig(env = process.env) {
  const problemes = [];
  const verifier = (variable, brut) => {
    if (!estAbsolu(brut)) {
      problemes.push(`${variable}=${brut} : ce n'est pas un chemin absolu. Ecris le chemin complet, par exemple G:\\Mon Drive\\JDR.`);
      return null;
    }
    const chemin = developper(brut);
    if (dansLeProjet(chemin)) {
      problemes.push(`${variable}=${brut} : ce dossier est DANS le projet. Les donnees doivent vivre dans ton dossier cloud, pas a cote du code.`);
      return null;
    }
    return chemin;
  };

  const brutRacine = brutDe(env.VTT_ASSETS);
  if (!brutRacine) problemes.push("VTT_ASSETS est vide : indique le chemin de ton dossier cloud (lance : npm run detecter-assets).");
  const racineAssets = brutRacine ? verifier("VTT_ASSETS", brutRacine) : null;

  const dossiers = Object.fromEntries(
    Object.entries(CATEGORIES).map(([categorie, variable]) => {
      const brut = brutDe(env[variable]);
      const chemin = brut ? verifier(variable, brut) : racineAssets && join(racineAssets, categorie);
      return [categorie, chemin];
    }),
  );

  return {
    problemes,
    nomDeLaPartie: brutDe(env.VTT_NOM_PARTIE) || "Ma campagne",
    nomDuPoste: brutDe(env.VTT_NOM_POSTE) || hostname(),
    port: Number(env.VTT_PORT ?? env.PORT ?? 3000),
    motDePasseMJ: brutDe(env.VTT_MOTDEPASSE_MJ) || "change-moi",
    racineAssets,
    cloud: racineAssets ? detecterCloud(racineAssets) : null,
    dossiers,
  };
}

export function chargerConfig() {
  const envTrouve = chargerFichierEnv();
  return { envTrouve, ...construireConfig(process.env) };
}

/**
 * Anciennes parties restees dans le dossier du projet (avant la correction du
 * sprint 7, un .env non rempli y envoyait les sauvegardes sans prevenir).
 */
export function anciennesPartiesLocales() {
  const dossier = join(RACINE, "donnees-mj", "parties");
  if (!existsSync(dossier)) return { dossier, tables: [] };
  try {
    const tables = readdirSync(dossier, { withFileTypes: true }).filter((e) => e.isDirectory() && /^t-[0-9a-f]{10}$/.test(e.name));
    return { dossier, tables: tables.map((e) => e.name) };
  } catch {
    return { dossier, tables: [] };
  }
}
