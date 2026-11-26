// Depense et recuperation des ressources (Mana, Rage, Eclats d'ame...).
import { ErreurRegle } from "./erreurs.js";

/** Nouvelle valeur d'une ressource apres un repos, selon SA regle. */
export function appliquerRegleRepos(ressource, regle) {
  let actuel = ressource.actuel;
  if (regle === "remplir") actuel = ressource.max;
  else if (regle === "vider") actuel = 0;
  else if (regle === "moitie") actuel += Math.ceil(ressource.max / 2);
  else if (regle && typeof regle === "object" && "ajouter" in regle) actuel += regle.ajouter;
  // "aucun" : rien ne change
  return { ...ressource, actuel: Math.min(ressource.max, Math.max(0, actuel)) };
}

/**
 * Depenser (variation negative) ou gagner (variation positive).
 * On ne peut pas depenser ce qu'on n'a pas ; un gain est plafonne au maximum.
 */
export function modifierRessource(ressource, variation) {
  if (!Number.isInteger(variation) || variation === 0) {
    throw new ErreurRegle("La variation doit etre un nombre entier non nul.");
  }
  if (variation < 0 && ressource.actuel + variation < 0) {
    throw new ErreurRegle(`Pas assez de ${ressource.nom} (${ressource.actuel}/${ressource.max}).`);
  }
  return { ...ressource, actuel: Math.min(ressource.max, ressource.actuel + variation) };
}

/** Applique un repos ("court" ou "long") a toutes les ressources, et liste ce qui a change. */
export function reposDesRessources(ressources, typeRepos) {
  const cleRegle = typeRepos === "court" ? "reposCourt" : "reposLong";
  const changements = [];
  const nouvelles = ressources.map((ressource) => {
    const apres = appliquerRegleRepos(ressource, ressource[cleRegle]);
    if (apres.actuel !== ressource.actuel) {
      changements.push({ cle: ressource.cle, nom: ressource.nom, avant: ressource.actuel, apres: apres.actuel });
    }
    return apres;
  });
  return { ressources: nouvelles, changements };
}
