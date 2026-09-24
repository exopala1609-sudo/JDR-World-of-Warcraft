// Verrou de partie, pose dans le dossier synchronise.
// Scenario a eviter : le serveur tourne sur le PC fixe, tu ouvres le portable
// et tu le lances aussi. Les deux ecrivent dans le meme dossier cloud et la
// sauvegarde part en "fichier en conflit". Le verrou previent avant le drame.
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { ecrireJsonAtomique, lireJson } from "./fichiers.js";

const FRAICHEUR_MS = 90_000; // au-dela, le verrou est considere comme abandonne
const BATTEMENT_MS = 30_000;

export function poserVerrou(config) {
  const chemin = join(config.dossiers.parties, "partie-en-cours.verrou.json");
  const existant = lireJson(chemin);

  if (existant && Date.now() - existant.horodatage < FRAICHEUR_MS && existant.poste !== config.nomDuPoste) {
    console.warn("");
    console.warn("  ********************************************************");
    console.warn(`  ATTENTION : une partie semble deja ouverte sur "${existant.poste}".`);
    console.warn("  Ferme-la avant de continuer, sinon les deux postes vont");
    console.warn("  ecrire en meme temps dans le dossier synchronise.");
    console.warn("  ********************************************************");
    console.warn("");
  }

  const ecrire = () =>
    ecrireJsonAtomique(chemin, {
      poste: config.nomDuPoste,
      pid: process.pid,
      horodatage: Date.now(),
    });

  try {
    ecrire();
  } catch (erreur) {
    console.warn(`[verrou] Impossible d'ecrire le verrou (${erreur.message}). On continue sans.`);
    return () => {};
  }

  const battement = setInterval(() => {
    try {
      ecrire();
    } catch {
      /* dossier momentanement indisponible : sans gravite */
    }
  }, BATTEMENT_MS);
  battement.unref();

  // Renvoie la fonction qui retire le verrou (appelee a l'arret du serveur).
  return function liberer() {
    clearInterval(battement);
    try {
      unlinkSync(chemin);
    } catch {
      /* deja supprime */
    }
  };
}
