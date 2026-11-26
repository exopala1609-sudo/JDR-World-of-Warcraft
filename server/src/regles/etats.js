// Poser, retirer et faire expirer les etats (auras / debuffs).
import { nouvelId } from "../modeles/identifiants.js";
import { ErreurRegle } from "./erreurs.js";

/**
 * Pose un etat. Comme dans WoW, un meme etat ne se cumule pas avec lui-meme :
 * le reposer rafraichit simplement sa duree.
 * definition = { cle, nom, nature, icone, description }
 */
export function poserEtat(personnage, definition, { rounds = null, par }) {
  if (rounds !== null && (!Number.isInteger(rounds) || rounds < 1 || rounds > 100)) {
    throw new ErreurRegle("La duree doit etre comprise entre 1 et 100 rounds.");
  }
  const existant = personnage.etats.find((e) => e.cle === definition.cle);
  const etat = {
    id: existant?.id ?? nouvelId("e"),
    cle: definition.cle,
    nom: definition.nom,
    nature: definition.nature,
    icone: definition.icone ?? definition.cle,
    description: definition.description ?? "",
    roundsRestants: rounds,
    posePar: par,
  };
  const etats = existant
    ? personnage.etats.map((e) => (e.id === existant.id ? etat : e))
    : [...personnage.etats, etat];
  return { personnage: { ...personnage, etats }, etat, rafraichi: Boolean(existant) };
}

export function retirerEtat(personnage, idEtat) {
  const etat = personnage.etats.find((e) => e.id === idEtat);
  if (!etat) throw new ErreurRegle("Cet etat n'est plus actif.");
  return { personnage: { ...personnage, etats: personnage.etats.filter((e) => e.id !== idEtat) }, etat };
}

/**
 * Fin du tour du personnage : chaque etat a duree perd 1 round ;
 * ceux qui tombent a 0 disparaissent. Les etats sans duree restent.
 */
export function ecoulerUnRound(personnage) {
  const expires = [];
  const etats = [];
  for (const etat of personnage.etats) {
    if (etat.roundsRestants === null) etats.push(etat);
    else if (etat.roundsRestants > 1) etats.push({ ...etat, roundsRestants: etat.roundsRestants - 1 });
    else expires.push(etat);
  }
  // Il y a du changement des qu'au moins un etat avait une duree.
  const change = personnage.etats.some((e) => e.roundsRestants !== null);
  return { personnage: { ...personnage, etats }, expires, change };
}
