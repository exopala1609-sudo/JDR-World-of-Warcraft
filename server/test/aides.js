// Outils communs aux tests (ce fichier n'est pas lui-meme un test).
import { creerReferentiel } from "../src/donnees/referentiel.js";

/** Le referentiel d'exemple du projet (races, classes... provisoires). */
export function referentielExemple() {
  const referentiel = creerReferentiel("exemples/referentiel");
  referentiel.charger();
  return referentiel;
}
