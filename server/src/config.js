// Lecture de config.json : le seul fichier que le MJ edite a la main.
import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const CONFIG_PAR_DEFAUT = {
  nomDeLaPartie: "Ma campagne",
  port: 3000,
  motDePasseMJ: "change-moi",
  dossiers: {
    cartes: "./donnees-mj/cartes",
    jetons: "./donnees-mj/jetons",
    portraits: "./donnees-mj/portraits",
    compendium: "./donnees-mj/compendium",
  },
};

function resoudreChemin(chemin) {
  // Accepte aussi bien "./donnees-mj/cartes" que "D:\\JDR\\Cartes".
  return isAbsolute(chemin) ? chemin : resolve(RACINE, chemin);
}

export function chargerConfig() {
  const fichier = resolve(RACINE, "config.json");
  let brut = {};

  if (existsSync(fichier)) {
    try {
      brut = JSON.parse(readFileSync(fichier, "utf8"));
    } catch (erreur) {
      console.error("[config] config.json est illisible (JSON invalide) :", erreur.message);
      console.error("[config] Valeurs par defaut utilisees.");
    }
  } else {
    console.warn("[config] config.json introuvable, valeurs par defaut utilisees.");
  }

  const dossiers = { ...CONFIG_PAR_DEFAUT.dossiers, ...(brut.dossiers ?? {}) };

  return {
    ...CONFIG_PAR_DEFAUT,
    ...brut,
    port: Number(process.env.PORT ?? brut.port ?? CONFIG_PAR_DEFAUT.port),
    dossiers: Object.fromEntries(
      Object.entries(dossiers).map(([cle, chemin]) => [cle, resoudreChemin(chemin)]),
    ),
  };
}
