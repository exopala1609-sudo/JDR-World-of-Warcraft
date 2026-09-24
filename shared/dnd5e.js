// Regles de base de D&D 5e, codees en dur (le projet ne gere que ce jeu).
// Fichier PARTAGE : le serveur s'en sert pour arbitrer, les navigateurs pour
// afficher (liste des classes...). Aucun calcul ici ne lit ni n'ecrit de fichier.

export const CARACTERISTIQUES = /** @type {const} */ ([
  "force",
  "dexterite",
  "constitution",
  "intelligence",
  "sagesse",
  "charisme",
]);

// Les 12 classes du Manuel des joueurs et leur de de vie.
export const CLASSES = /** @type {const} */ ({
  barbare: { nom: "Barbare", deDeVie: 12 },
  barde: { nom: "Barde", deDeVie: 8 },
  clerc: { nom: "Clerc", deDeVie: 8 },
  druide: { nom: "Druide", deDeVie: 8 },
  ensorceleur: { nom: "Ensorceleur", deDeVie: 6 },
  guerrier: { nom: "Guerrier", deDeVie: 10 },
  magicien: { nom: "Magicien", deDeVie: 6 },
  moine: { nom: "Moine", deDeVie: 8 },
  occultiste: { nom: "Occultiste", deDeVie: 8 },
  paladin: { nom: "Paladin", deDeVie: 10 },
  rodeur: { nom: "Rodeur", deDeVie: 10 },
  roublard: { nom: "Roublard", deDeVie: 8 },
});

/** Modificateur d'une caracteristique : 10-11 -> +0, 14 -> +2, 8 -> -1. */
export function modificateur(valeur) {
  return Math.floor((valeur - 10) / 2);
}

/** Bonus de maitrise selon le niveau : +2 (niv. 1-4) jusqu'a +6 (niv. 17-20). */
export function bonusDeMaitrise(niveau) {
  return 2 + Math.floor((niveau - 1) / 4);
}

/**
 * Classe d'armure sans armure. Deux classes ont une regle speciale
 * ("Defense sans armure") : le Barbare ajoute sa CON, le Moine sa SAG.
 */
export function classeArmureSansArmure(classe, caracteristiques) {
  const base = 10 + modificateur(caracteristiques.dexterite);
  if (classe === "barbare") return base + modificateur(caracteristiques.constitution);
  if (classe === "moine") return base + modificateur(caracteristiques.sagesse);
  return base;
}

/**
 * Ressources de classe d'un personnage de NIVEAU 1 (regles D&D 5e).
 * La progression par niveau arrivera avec la montee de niveau : on ne
 * pre-remplit donc rien pour un personnage cree directement a un niveau superieur.
 * Les jauges facon WoW (Mana, Rage...) s'ajoutent ensuite depuis
 * shared/ressources.js.
 */
export function ressourcesDeDepart(classe, caracteristiques) {
  const compteur = (cle, nom, max, reposCourt, reposLong, apparence) => ({
    cle,
    nom,
    type: "compteur",
    actuel: max,
    max,
    reposCourt,
    reposLong,
    apparence,
  });
  const emplacements = (max, reposCourt = "aucun") =>
    compteur("emplacements-niveau-1", "Emplacements de sort (niv. 1)", max, reposCourt, "remplir", "emplacement-sort");

  switch (classe) {
    case "barbare":
      return [compteur("rage-barbare", "Rages (utilisations)", 2, "aucun", "remplir", "rage")];
    case "guerrier":
      return [compteur("second-souffle", "Second souffle", 1, "remplir", "remplir", "second-souffle")];
    case "barde": {
      const max = Math.max(1, modificateur(caracteristiques.charisme));
      return [
        compteur("inspiration-bardique", "Inspiration bardique", max, "aucun", "remplir", "inspiration"),
        emplacements(2),
      ];
    }
    case "clerc":
    case "druide":
    case "magicien":
    case "ensorceleur":
      return [emplacements(2)];
    case "occultiste":
      // Particularite de l'Occultiste : ses emplacements reviennent au repos court.
      return [emplacements(1, "remplir")];
    default:
      // Moine, Paladin, Rodeur, Roublard : pas de ressource au niveau 1.
      return [];
  }
}
