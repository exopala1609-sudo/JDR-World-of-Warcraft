// Configuration du poste courant, lue dans le fichier .env a la racine.
// Un .env par ordinateur : c'est ce qui permet de passer du PC fixe au
// portable en ne changeant qu'une seule ligne (VTT_ASSETS).
import { existsSync } from "node:fs";
import { hostname } from "node:os";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Sous-dossiers attendus dans le dossier d'assets, et leur variable d'override.
export const CATEGORIES = /** @type {const} */ ({
  cartes: "VTT_ASSETS_CARTES",
  jetons: "VTT_ASSETS_JETONS",
  portraits: "VTT_ASSETS_PORTRAITS",
  icones: "VTT_ASSETS_ICONES",
  compendium: "VTT_ASSETS_COMPENDIUM",
  parties: "VTT_ASSETS_PARTIES",
});

// Categories exposees telles quelles aux navigateurs. Le compendium et les
// sauvegardes passeront par l'API (le MJ decide ce que les joueurs voient).
export const CATEGORIES_PUBLIQUES = ["jetons", "portraits", "cartes", "icones"];

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

/** Nettoie une valeur de .env : guillemets, espaces, "~" de raccourci. */
function nettoyerChemin(valeur) {
  if (typeof valeur !== "string") return null;
  const brut = valeur.trim().replace(/^["']|["']$/g, "");
  if (!brut) return null;
  const developpe = brut.startsWith("~") ? join(homedir(), brut.slice(1)) : brut;
  return isAbsolute(developpe) ? developpe : resolve(RACINE, developpe);
}

export function detecterCloud(chemin) {
  return CLOUDS_CONNUS.find(({ motif }) => motif.test(chemin))?.nom ?? null;
}

export function chargerConfig() {
  const envTrouve = chargerFichierEnv();

  const racineAssets = nettoyerChemin(process.env.VTT_ASSETS) ?? resolve(RACINE, "donnees-mj");

  const dossiers = Object.fromEntries(
    Object.entries(CATEGORIES).map(([categorie, variable]) => [
      categorie,
      nettoyerChemin(process.env[variable]) ?? join(racineAssets, categorie),
    ]),
  );

  return {
    envTrouve,
    nomDeLaPartie: process.env.VTT_NOM_PARTIE?.trim() || "Ma campagne",
    nomDuPoste: process.env.VTT_NOM_POSTE?.trim() || hostname(),
    port: Number(process.env.VTT_PORT ?? process.env.PORT ?? 3000),
    motDePasseMJ: process.env.VTT_MOTDEPASSE_MJ?.trim() || "change-moi",
    racineAssets,
    cloud: detecterCloud(racineAssets),
    dossiers,
  };
}
