// Regles de base de D&D 5e, codees en dur (le projet ne gere que ce jeu).
// Fichier PARTAGE : le serveur s'en sert pour arbitrer, les navigateurs pour
// afficher. Aucun calcul ici ne lit ni n'ecrit de fichier.

export const CARACTERISTIQUES = /** @type {const} */ ([
  "force",
  "dexterite",
  "constitution",
  "intelligence",
  "sagesse",
  "charisme",
]);

// Les classes et les races ne sont PAS ici : elles vivent dans les fichiers du
// referentiel (dossier referentiel/ du cloud), modifiables sans toucher au code.
// Voir shared/creation.js pour les calculs de creation (PV, CA, ressources).

/** Modificateur d'une caracteristique : 10-11 -> +0, 14 -> +2, 8 -> -1. */
export function modificateur(valeur) {
  return Math.floor((valeur - 10) / 2);
}

/** Bonus de maitrise selon le niveau : +2 (niv. 1-4) jusqu'a +6 (niv. 17-20). */
export function bonusDeMaitrise(niveau) {
  return 2 + Math.floor((niveau - 1) / 4);
}
