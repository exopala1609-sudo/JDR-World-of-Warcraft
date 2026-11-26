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

// --- Caracteristiques de base (avant les bonus d'historique) ---------------------

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

/**
 * Les valeurs a repartir : tableau standard, ou tirage aux des du joueur.
 * @param {string} methode
 * @param {any} regles
 * @param {number[] | null} [valeursTirage]
 */
export function valeursARepartir(methode, regles, valeursTirage = null) {
  return methode === "tirage-4d6" ? (valeursTirage ?? []) : regles.tableauStandard;
}

/**
 * Point de depart d'une methode : ce que l'ecran propose avant tout choix.
 * "valeursTirage" : les 6 scores tires aux des (methode "tirage-4d6").
 * @param {string} methode
 * @param {any} regles
 * @param {string[]} [principales]
 * @param {number[] | null} [valeursTirage]
 * @returns {Record<"force" | "dexterite" | "constitution" | "intelligence" | "sagesse" | "charisme", number>}
 */
export function baseParDefaut(methode, regles, principales = [], valeursTirage = null) {
  if (methode === "achat-de-points" || (methode === "tirage-4d6" && !valeursTirage)) {
    const minimum = methode === "achat-de-points" ? scoresAchat(regles)[0] : 10; // 10 : en attendant les des
    return Object.fromEntries(CARACTERISTIQUES.map((c) => [c, minimum]));
  }
  // Valeurs a repartir : les meilleures vont aux caracteristiques principales de la classe.
  const ordre = [...principales, ...CARACTERISTIQUES.filter((c) => !principales.includes(c))];
  const valeurs = [...valeursARepartir(methode, regles, valeursTirage)].sort((a, b) => b - a);
  return Object.fromEntries(ordre.map((c, i) => [c, valeurs[i]]));
}

/** Les methodes proposees a une table : celles du referentiel, filtrees par le MJ. */
export function methodesDeLaTable(regles, reglagesTable) {
  const choisies = reglagesTable?.methodes;
  const permises = choisies ? regles.methodes.filter((m) => choisies.includes(m)) : regles.methodes;
  return permises.length ? permises : regles.methodes;
}

/**
 * La repartition respecte-t-elle la methode choisie ?
 * "methodes" : celles permises a la table ; "valeursTirage" : le tirage du joueur.
 * @param {string} methode
 * @param {any} base
 * @param {any} regles
 * @param {{ methodes?: string[], valeursTirage?: number[] | null }} [options]
 */
export function verifierBase(methode, base, regles, { methodes = regles.methodes, valeursTirage = null } = {}) {
  if (!regles.methodes.includes(methode)) return "Cette methode de caracteristiques n'est pas autorisee.";
  if (!methodes.includes(methode)) return "Le MJ n'a pas permis cette methode de caracteristiques a cette table.";
  const valeurs = CARACTERISTIQUES.map((c) => base[c]);
  if (valeurs.some((v) => !Number.isInteger(v))) return "Chaque caracteristique doit recevoir une valeur.";

  if (methode === "tirage-4d6") {
    if (!valeursTirage) return "Lance d'abord les des.";
    const attendu = [...valeursTirage].sort((a, b) => a - b).join(",");
    if ([...valeurs].sort((a, b) => a - b).join(",") !== attendu) {
      return `Repartis exactement les valeurs de ton tirage (${[...valeursTirage].sort((a, b) => b - a).join(", ")}).`;
    }
    return null;
  }

  if (methode === "tableau-standard") {
    const attendu = [...regles.tableauStandard].sort((a, b) => a - b).join(",");
    if ([...valeurs].sort((a, b) => a - b).join(",") !== attendu) {
      return `Repartis exactement les valeurs du tableau standard (${regles.tableauStandard.join(", ")}).`;
    }
    return null;
  }

  const scores = scoresAchat(regles);
  if (valeurs.some((v) => v < scores[0] || v > scores.at(-1))) {
    return `Achat de points : chaque score va de ${scores[0]} a ${scores.at(-1)} avant les bonus.`;
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

// --- Historique (D&D 2024 : c'est LUI qui donne les bonus de caracteristiques) -------

/**
 * Repartition des bonus d'historique : { force: 2, constitution: 1 } ou
 * { force: 1, dexterite: 1, constitution: 1 }, uniquement sur les 3
 * caracteristiques de l'historique. Renvoie un message d'erreur, ou null.
 * @param {any} historique
 * @param {Record<string, number>} [repartition]
 */
export function verifierRepartitionHistorique(historique, repartition = {}) {
  if (!historique) return "Choisis un historique.";
  const places = Object.entries(repartition).filter(([, v]) => v);
  if (places.some(([c]) => !historique.caracteristiques.includes(c))) {
    return `${historique.nom} : bonus a placer sur ${historique.caracteristiques.map((c) => NOMS_CARACTERISTIQUES[c]).join(", ")}.`;
  }
  const valeurs = places.map(([, v]) => v).sort((a, b) => a - b).join(",");
  if (valeurs !== "1,2" && valeurs !== "1,1,1") return "Bonus d'historique : +2 et +1 sur deux caracteristiques, ou +1 sur les trois.";
  return null;
}

/** Repartition proposee d'office : +2 et +1 sur les caracteristiques de l'historique les plus utiles a la classe. */
export function repartitionParDefaut(historique, principales = []) {
  if (!historique) return {};
  const ordre = [...historique.caracteristiques].sort((a, b) => {
    const rang = (c) => (principales.includes(c) ? principales.indexOf(c) : 10);
    return rang(a) - rang(b);
  });
  return { [ordre[0]]: 2, [ordre[1]]: 1 };
}

/** Bonus total : race (anciennes regles, si le referentiel en donne) + historique. */
export function bonusTotal(race, bonusAuChoix = [], repartition = {}) {
  const bonus = bonusDeRace(race, bonusAuChoix);
  for (const [c, v] of Object.entries(repartition)) if (c in bonus && v) bonus[c] += v;
  return bonus;
}

// --- Peuples : options (lignee, clan, weyrn...) et restrictions de lore --------------------

/** La race est-elle jouable dans cette faction ? (toujours, en lore libre) */
export function raceDisponible(race, idFaction, loreLibre = false) {
  return loreLibre || race.factions.includes(idFaction);
}

/** Les choix possibles d'une option pour cette faction (tous, en lore libre). */
export function choixPossibles(option, idFaction, loreLibre = false) {
  return option.choix.filter((c) => loreLibre || !c.factions || c.factions.includes(idFaction));
}

/** Les choix retenus par le joueur, dans l'ordre des options de la race (objets complets). */
export function choixRetenus(race, choixOptions = {}) {
  return (race.options ?? []).flatMap((option) => option.choix.filter((c) => c.id === choixOptions[option.id]));
}

/**
 * Chaque option de la race a-t-elle recu un choix valable pour cette faction ?
 * @param {any} race
 * @param {Record<string, string>} [choixOptions] { idOption: idChoix }
 */
export function verifierOptions(race, choixOptions = {}, idFaction = "", loreLibre = false) {
  const options = race.options ?? [];
  const inconnues = Object.keys(choixOptions).filter((id) => !options.some((o) => o.id === id));
  if (inconnues.length) return `${race.nom} : option inconnue (${inconnues.join(", ")}).`;
  for (const option of options) {
    const id = choixOptions[option.id];
    if (!id) return `${race.nom} : choisis ${option.nom.toLowerCase()}.`;
    const choix = option.choix.find((c) => c.id === id);
    if (!choix) return `${race.nom} : choix inconnu pour ${option.nom.toLowerCase()}.`;
    if (!choixPossibles(option, idFaction, loreLibre).includes(choix)) return `${choix.nom} : indisponible pour cette faction.`;
  }
  return null;
}

/**
 * Restriction "de lore" d'une classe (ex. Evocateur : Dracthyr seulement).
 * Renvoie le message a afficher, ou null si la combinaison est conforme au lore.
 */
export function restrictionDeLore(classe, race, choixOptions = {}) {
  if (race && Array.isArray(race.classesAutorisees) && !race.classesAutorisees.includes(classe.id)) {
    return `${race.nom} : la classe ${classe.nom} n'est pas prevue par le lore.`;
  }
  const regle = classe.restrictionLore;
  if (!regle || !race) return null;
  const retenus = Object.values(choixOptions);
  const conforme = regle.peuples.some((p) => p.race === race.id && (!p.choix || p.choix.some((id) => retenus.includes(id))));
  return conforme ? null : regle.message || `Lore : ${classe.nom} est reserve a d'autres peuples.`;
}

/**
 * Ce que la race et ses options donnent au personnage : taille, type de
 * creature, apparence (images), traits et renommee de depart.
 */
export function detailsOrigine(race, classe, choixOptions = {}) {
  const retenus = choixRetenus(race, choixOptions);
  const dernier = (champ) => retenus.reduce((valeur, c) => (c[champ] !== undefined ? c[champ] : valeur), undefined);
  const renommeeChoix = dernier("renommee");
  return {
    taille: dernier("taille") ?? race.taille ?? "moyenne",
    typeCreature: classe?.typeCreature ?? dernier("typeCreature") ?? race.typeCreature ?? "Humanoide",
    apparence: dernier("apparence") ?? race.id,
    traits: [...(race.traits ?? []), ...retenus.flatMap((c) => c.traits ?? [])],
    renommee: renommeeChoix !== undefined ? renommeeChoix : (race.renommee ?? null),
  };
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
 * personnage de niveau 1. "choix" = { race, classe, base, bonusAuChoix,
 * repartition (bonus d'historique), choixOptions (lignee...) } (race et classe :
 * les ENTREES du referentiel, pas leurs identifiants).
 * @param {{ race: any, classe: any, base: Record<string, number>, bonusAuChoix?: string[], repartition?: Record<string, number>, choixOptions?: Record<string, string> }} choix
 * @param {any} referentiel
 */
export function apercuPersonnage({ race, classe, base, bonusAuChoix = [], repartition = {}, choixOptions = {} }, referentiel) {
  const modeles = Object.fromEntries(referentiel.ressources.map((r) => [r.id, r]));
  const bonus = bonusTotal(race, bonusAuChoix, repartition);
  const origine = detailsOrigine(race, classe, choixOptions);
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
    ...origine,
  };
}

// --- Langues et renommee (etape 3) ---------------------------------------------------------

/**
 * Le personnage joue-t-il HORS de sa faction ? (lore libre : un Orc dans
 * l'Alliance, un elfe de sang chez les Alliance...)
 */
export function horsFaction(race, choixOptions, idFaction) {
  return !race.factions.includes(idFaction) || choixRetenus(race, choixOptions).some((c) => c.factions && !c.factions.includes(idFaction));
}

/**
 * Les langues proposees a la creation : la table de sa faction ; les deux tables
 * pour un peuple sans faction (Dracthyr sans weyrn de camp...) ; plus la langue
 * de son peuple s'il joue hors de sa faction. Jamais les langues rares.
 */
export function languesProposees({ race, choixOptions = {}, idFaction }, referentiel) {
  const sansFaction = race.factions.length > 1 && !choixRetenus(race, choixOptions).some((c) => c.factions);
  const tables = sansFaction ? race.factions : [idFaction];
  const ids = (referentiel.langues ?? []).filter((l) => !l.rare && l.tables.some((t) => tables.includes(t))).map((l) => l.id);
  if (race.langue && !ids.includes(race.langue) && horsFaction(race, choixOptions, idFaction)) ids.push(race.langue);
  return ids;
}

/** Les langues choisies sont-elles correctes ? (null = oui) */
export function verifierLangues(langues, proposees, nombre) {
  if (!proposees.length || nombre === 0) return langues.length ? "Aucune langue a choisir ici." : null;
  if (new Set(langues).size !== langues.length) return "Une langue est choisie deux fois.";
  const absente = langues.find((l) => !proposees.includes(l));
  if (absente) return `Langue non proposee a ce personnage : ${absente}.`;
  const attendu = Math.min(nombre, proposees.length);
  if (langues.length !== attendu) return `Choisis ${attendu} langue${attendu > 1 ? "s" : ""}.`;
  return null;
}

/**
 * La renommee de depart : celle du peuple (ou de son choix : lignee, weyrn...)
 * plus celle de la classe (Mage : Kirin Tor...). Hors de sa faction, la faction
 * d'un camp de son peuple le voit d'un mauvais oeil (renommeeHorsFaction : -3).
 * Renvoie [{ faction, score }].
 */
export function renommeesDeDepart({ race, classe, choixOptions = {}, idFaction }, referentiel) {
  const sources = [detailsOrigine(race, classe, choixOptions).renommee, classe?.renommee].filter(Boolean);
  const scores = new Map();
  for (const source of sources) {
    const faction = (referentiel.renommees ?? []).find((f) => f.id === source.faction);
    if (!faction) continue;
    const valeur = faction.faction && faction.faction !== idFaction ? referentiel.creation.renommeeHorsFaction : source.valeur;
    scores.set(faction.id, (scores.get(faction.id) ?? 0) + valeur);
  }
  return [...scores].map(([faction, score]) => ({ faction, score }));
}

/**
 * Le palier d'un score de renommee (Neutre, Amical, Honore...), le suivant, et
 * l'avancement de la barre vers le suivant (0 a 1).
 */
export function palierRenommee(score, paliers) {
  let index = 0;
  paliers.forEach((p, i) => {
    if (score >= p.min) index = i;
  });
  const palier = paliers[index];
  const suivant = paliers[index + 1] ?? null;
  const progression = suivant ? Math.max(0, Math.min(1, (score - palier.min) / (suivant.min - palier.min))) : 1;
  return { palier, suivant, progression };
}
