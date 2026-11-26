// Regles de creation de personnage : fichier PARTAGE.
//
// Le navigateur s'en sert pour l'APERCU (points restants, PV, CA, ressources
// affiches pendant que le joueur choisit) ; le serveur s'en sert pour ARBITRER
// (il refait tout le calcul et refuse une demande incoherente). Meme code des
// deux cotes : ce que le joueur voit est exactement ce que le serveur enregistre.
//
// Aucune race ni classe n'est ecrite ici : tout vient du REFERENTIEL (les
// fichiers JSON du dossier referentiel/, modifiables au Bloc-notes).
// Les fonctions "verifier..." renvoient un message d'erreur en francais, ou null.
import { CARACTERISTIQUES, modificateur } from "./dnd5e.js";

export const NOMS_CARACTERISTIQUES = /** @type {const} */ ({
  force: "Force",
  dexterite: "Dexterite",
  constitution: "Constitution",
  intelligence: "Intelligence",
  sagesse: "Sagesse",
  charisme: "Charisme",
});

// --- Caracteristiques de base (avant les bonus de race) -------------------------

/** Scores autorises par l'achat de points, du plus petit au plus grand (ex. 8 a 15). */
export function scoresAchat(regles) {
  return Object.keys(regles.achatDePoints.couts)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Points depenses pour ces scores (achat de points). */
export function pointsDepenses(base, regles) {
  return CARACTERISTIQUES.reduce((total, c) => total + (regles.achatDePoints.couts[base[c]] ?? 0), 0);
}

/** Point de depart d'une methode : ce que l'ecran propose avant tout choix. */
export function baseParDefaut(methode, regles, principales = []) {
  if (methode === "achat-de-points") {
    const minimum = scoresAchat(regles)[0];
    return Object.fromEntries(CARACTERISTIQUES.map((c) => [c, minimum]));
  }
  // Tableau standard : les meilleures valeurs vont aux caracteristiques principales de la classe.
  const ordre = [...principales, ...CARACTERISTIQUES.filter((c) => !principales.includes(c))];
  const valeurs = [...regles.tableauStandard].sort((a, b) => b - a);
  return Object.fromEntries(ordre.map((c, i) => [c, valeurs[i]]));
}

/** La repartition respecte-t-elle la methode choisie ? */
export function verifierBase(methode, base, regles) {
  if (!regles.methodes.includes(methode)) return "Cette methode de caracteristiques n'est pas autorisee.";
  const valeurs = CARACTERISTIQUES.map((c) => base[c]);
  if (valeurs.some((v) => !Number.isInteger(v))) return "Chaque caracteristique doit recevoir une valeur.";

  if (methode === "tableau-standard") {
    const attendu = [...regles.tableauStandard].sort((a, b) => a - b).join(",");
    if ([...valeurs].sort((a, b) => a - b).join(",") !== attendu) {
      return `Repartis exactement les valeurs du tableau standard (${regles.tableauStandard.join(", ")}).`;
    }
    return null;
  }

  const scores = scoresAchat(regles);
  if (valeurs.some((v) => v < scores[0] || v > scores.at(-1))) {
    return `Achat de points : chaque score va de ${scores[0]} a ${scores.at(-1)} avant les bonus de race.`;
  }
  const depense = pointsDepenses(base, regles);
  if (depense > regles.achatDePoints.budget) {
    return `Achat de points : ${depense} points depenses pour ${regles.achatDePoints.budget} disponibles.`;
  }
  return null;
}

// --- Bonus de race --------------------------------------------------------------------

/** Caracteristiques parmi lesquelles le joueur peut placer ses bonus "au choix". */
export function caracteristiquesAuChoix(race) {
  const parmi = race.bonusAuChoix?.parmi ?? "toutes";
  return parmi === "toutes" ? [...CARACTERISTIQUES] : parmi;
}

/**
 * Le choix des bonus "au choix" (regles 2024) est-il valable ?
 * @param {any} race
 * @param {string[]} [choix]
 */
export function verifierChoixBonus(race, choix = []) {
  const attendus = race.bonusAuChoix?.bonus ?? [];
  if (choix.length !== attendus.length) {
    return attendus.length ? `Place tes ${attendus.length} bonus de race (${attendus.map((b) => `+${b}`).join(", ")}).` : "Cette race n'a pas de bonus au choix.";
  }
  if (new Set(choix).size !== choix.length) return "Chaque bonus de race va sur une caracteristique differente.";
  const permises = caracteristiquesAuChoix(race);
  if (choix.some((c) => !permises.includes(c))) return "Bonus de race place sur une caracteristique non autorisee.";
  return null;
}

/**
 * Bonus de race total par caracteristique : bonus fixes + bonus places par le joueur.
 * @param {any} race
 * @param {string[]} [choix]
 */
export function bonusDeRace(race, choix = []) {
  const bonus = Object.fromEntries(CARACTERISTIQUES.map((c) => [c, race.bonusCaracteristiques?.[c] ?? 0]));
  (race.bonusAuChoix?.bonus ?? []).forEach((valeur, i) => {
    if (choix[i]) bonus[choix[i]] += valeur;
  });
  return bonus;
}

/** Scores finaux : base + bonus de race, plafonnes (20 par defaut). */
export function caracteristiquesFinales(base, bonus, regles) {
  return Object.fromEntries(
    CARACTERISTIQUES.map((c) => [c, Math.max(1, Math.min(regles.caracteristiqueMaximale, base[c] + bonus[c]))]),
  );
}

// --- Valeurs derivees (calculees, jamais saisies) ----------------------------------------

/**
 * PV max selon la regle "valeur fixe" du Manuel des joueurs : niveau 1 = de de
 * vie complet + mod. CON ; ensuite moyenne arrondie au superieur + mod. CON
 * par niveau (minimum 1 PV par niveau). "pvParNiveau" : bonus de race (nain...).
 */
export function pvMax(deDeVie, niveau, constitution, pvParNiveau = 0) {
  const modCon = modificateur(constitution);
  const premierNiveau = Math.max(1, deDeVie + modCon) + pvParNiveau;
  const parNiveauSuivant = Math.max(1, deDeVie / 2 + 1 + modCon) + pvParNiveau;
  return premierNiveau + (niveau - 1) * parNiveauSuivant;
}

/** CA sans armure : 10 + mod. DEX, + les caracteristiques de "defenseSansArmure" de la classe. */
export function classeArmureSansArmure(classe, caracteristiques) {
  const ajouts = classe.defenseSansArmure ?? [];
  return 10 + modificateur(caracteristiques.dexterite) + ajouts.reduce((t, c) => t + modificateur(caracteristiques[c]), 0);
}

/**
 * Ressources de depart d'une classe, pretes pour la fiche. "modeles" : les
 * ressources du referentiel (Mana, Rage...), par identifiant.
 */
export function ressourcesDeDepart(classe, caracteristiques, modeles) {
  return (classe.ressources ?? []).flatMap((choix) => {
    const modele = modeles[choix.ressource];
    if (!modele) return [];
    const max =
      typeof choix.max === "object"
        ? Math.max(choix.max.minimum, modificateur(caracteristiques[choix.max.modificateur]))
        : (choix.max ?? modele.max);
    return [
      {
        cle: modele.id,
        nom: modele.nom,
        type: modele.type,
        actuel: modele.depart === "vide" ? 0 : max,
        max,
        reposCourt: choix.reposCourt ?? modele.reposCourt,
        reposLong: choix.reposLong ?? modele.reposLong,
        apparence: modele.id,
      },
    ];
  });
}

/**
 * Tout ce que l'ecran affiche et que le serveur enregistre, pour un
 * personnage de niveau 1. "choix" = { race, classe, methode, base, bonusAuChoix }
 * (race et classe : les ENTREES du referentiel, pas leurs identifiants).
 * @param {{ race: any, classe: any, base: Record<string, number>, bonusAuChoix?: string[] }} choix
 * @param {any} referentiel
 */
export function apercuPersonnage({ race, classe, base, bonusAuChoix = [] }, referentiel) {
  const modeles = Object.fromEntries(referentiel.ressources.map((r) => [r.id, r]));
  const bonus = bonusDeRace(race, bonusAuChoix);
  const caracteristiques = caracteristiquesFinales(base, bonus, referentiel.creation);
  const pv = pvMax(classe.deDeVie, 1, caracteristiques.constitution, race.pvParNiveau ?? 0);
  return {
    bonus,
    caracteristiques,
    modificateurs: Object.fromEntries(CARACTERISTIQUES.map((c) => [c, modificateur(caracteristiques[c])])),
    pvMax: pv,
    classeArmure: classeArmureSansArmure(classe, caracteristiques),
    vitesse: race.vitesse ?? 9,
    ressources: ressourcesDeDepart(classe, caracteristiques, modeles),
  };
}
