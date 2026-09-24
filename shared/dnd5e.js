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

export const RARETES = /** @type {const} */ ([
  "pauvre",
  "commun",
  "peu-commun",
  "rare",
  "epique",
  "legendaire",
]);

// Quand une ressource se recharge.
export const RECUPERATIONS = /** @type {const} */ (["repos-court", "repos-long", "aucune"]);

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
 * Ressources de classe d'un personnage de NIVEAU 1.
 * La progression par niveau arrivera avec la montee de niveau : on ne
 * pre-remplit donc rien pour un personnage cree directement a un niveau superieur.
 */
export function ressourcesDeDepart(classe, caracteristiques) {
  const emplacements = (max, recuperation = "repos-long") => ({
    cle: "emplacements-niveau-1",
    nom: "Emplacements de sort (niv. 1)",
    actuel: max,
    max,
    recuperation,
  });

  switch (classe) {
    case "barbare":
      return [{ cle: "rage", nom: "Rage", actuel: 2, max: 2, recuperation: "repos-long" }];
    case "guerrier":
      return [{ cle: "second-souffle", nom: "Second souffle", actuel: 1, max: 1, recuperation: "repos-court" }];
    case "barde": {
      const max = Math.max(1, modificateur(caracteristiques.charisme));
      return [
        { cle: "inspiration-bardique", nom: "Inspiration bardique", actuel: max, max, recuperation: "repos-long" },
        emplacements(2),
      ];
    }
    case "clerc":
    case "druide":
    case "magicien":
      return [emplacements(2)];
    case "ensorceleur":
      return [emplacements(2)];
    case "occultiste":
      return [emplacements(1, "repos-court")];
    default:
      // Moine, Paladin, Rodeur, Roublard : pas de ressource au niveau 1.
      return [];
  }
}
