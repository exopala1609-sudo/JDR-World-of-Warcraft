// Resolution d'une action (attaque, sort) : le serveur lance les des et
// DETAILLE chaque terme, pour que la fenetre de resolution puisse afficher
// "De (14) + Force (+3) + Maitrise (+2) = 19". Fonctions PURES : le lancer de
// des est passe en parametre (un "faux de" dans les tests).
import { bonusDeMaitrise, modificateur } from "../../../shared/dnd5e.js";
import { NOMS_CARACTERISTIQUES } from "../../../shared/creation.js";
import { caracteristiqueIncantation, resolutionDuSort } from "../../../shared/magie.js";
import { lancerDes } from "./des.js";

const modif = (nom, valeur) => ({ nom, valeur });

/** Coup critique : on lance deux fois plus de des ("1d8+3" -> "2d8+3"). */
export function doublerDes(formule) {
  return formule.replace(/(\d*)d(\d+)/gi, (_, nombre, faces) => `${(Number(nombre) || 1) * 2}d${faces}`);
}

/** Un d20 et ses modificateurs : la ligne principale de la fenetre. */
function ligneD20(libelle, modificateurs, lancer) {
  const d20 = lancer("1d20").total;
  return {
    libelle,
    d20,
    des: null,
    modificateurs,
    total: d20 + modificateurs.reduce((t, m) => t + m.valeur, 0),
    critique: d20 === 20,
    echec: d20 === 1,
  };
}

/** Une ligne de des (degats, soins) : le detail de chaque de, puis les modificateurs. */
function ligneDes(libelle, formule, modificateurs, lancer) {
  const jet = lancer(formule);
  const des = jet.termes.filter((t) => t.type === "des").flatMap((t) => t.gardes.map((i) => t.jets[i]));
  return {
    libelle,
    d20: null,
    des: { formule, jets: des, total: jet.total },
    modificateurs,
    total: Math.max(0, jet.total + modificateurs.reduce((t, m) => t + m.valeur, 0)),
    critique: false,
    echec: false,
  };
}

/**
 * Attaque avec une arme equipee. "attaque" : une entree de attaquesEquipees()
 * (shared/equipement.js) : arme, caracteristique utilisee et son modificateur.
 */
export function jetArme(fiche, attaque, objet, lancer = lancerDes) {
  const maitrise = bonusDeMaitrise(fiche.niveau);
  const toucher = ligneD20(
    "Jet d'attaque",
    [modif(NOMS_CARACTERISTIQUES[attaque.caracteristique], attaque.modificateur), modif("Maitrise", maitrise)],
    lancer,
  );
  const formule = toucher.critique ? doublerDes(objet.arme.degats) : objet.arme.degats;
  const degats = ligneDes(`Degats (${objet.arme.typeDegats})`, formule, [modif(NOMS_CARACTERISTIQUES[attaque.caracteristique], attaque.modificateur)], lancer);
  return {
    action: { genre: "arme", nom: objet.nom, icone: objet.icone ?? objet.source ?? null, rarete: objet.rarete, detail: `Arme - ${attaque.emplacement}` },
    lignes: toucher.echec ? [toucher] : [toucher, degats], // un 1 naturel rate toujours
    note: toucher.critique ? "Coup critique : les des de degats sont doubles." : toucher.echec ? "Echec critique : l'attaque rate." : null,
  };
}

/** Lancer un sort du grimoire. "classe" : l'entree du referentiel (caracteristique d'incantation). */
export function jetSort(fiche, sort, classe, lancer = lancerDes) {
  const carac = caracteristiqueIncantation(classe);
  const mod = modificateur(fiche.caracteristiques[carac]);
  const maitrise = bonusDeMaitrise(fiche.niveau);
  const nomCarac = NOMS_CARACTERISTIQUES[carac];
  const resolution = resolutionDuSort(sort);
  const lignes = [];
  let note = null;

  let critique = false;
  if (resolution === "attaque") {
    const toucher = ligneD20("Attaque de sort", [modif(nomCarac, mod), modif("Maitrise", maitrise)], lancer);
    lignes.push(toucher);
    critique = toucher.critique;
    if (toucher.critique) note = "Coup critique : les des de degats sont doubles.";
    if (toucher.echec) note = "Echec critique : le sort rate sa cible.";
    if (toucher.echec) return { action: actionSort(sort), lignes, note };
  }
  if (resolution === "sauvegarde") {
    const dd = 8 + maitrise + mod;
    const sauvegarde = sort.sauvegarde ? NOMS_CARACTERISTIQUES[sort.sauvegarde] : "la caracteristique indiquee";
    note = `DD ${dd} (8 + Maitrise ${maitrise} + ${nomCarac} ${mod >= 0 ? "+" : ""}${mod}) : les cibles font un jet de sauvegarde de ${sauvegarde}.`;
  }
  if (sort.degats) {
    const formule = critique ? doublerDes(sort.degats.formule) : sort.degats.formule;
    lignes.push(ligneDes(`Degats (${sort.degats.type})`, formule, [], lancer));
  }
  if (sort.soins) lignes.push(ligneDes("Soins", sort.soins, [modif(nomCarac, mod)], lancer));
  return { action: actionSort(sort), lignes, note };
}

function actionSort(sort) {
  return {
    genre: "sort",
    nom: sort.nom,
    icone: sort.icone ?? sort.source ?? null,
    rarete: null,
    detail: sort.niveau === 0 ? `Sort mineur - ${sort.ecole}` : `Sort de niveau ${sort.niveau} - ${sort.ecole}`,
  };
}
