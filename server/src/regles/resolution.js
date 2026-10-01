// Resolution d'une action (attaque, sort) : le serveur lance les des et
// DETAILLE chaque terme, pour que la fenetre de resolution puisse afficher
// "De (14) + Force (+3) + Maitrise (+2) = 19". Fonctions PURES : le lancer de
// des est passe en parametre (un "faux de" dans les tests).
import { bonusDeMaitrise, bonusDeTest, modificateur } from "../../../shared/dnd5e.js";
import { NOMS_CARACTERISTIQUES } from "../../../shared/creation.js";
import { caracteristiqueIncantation, resolutionDuSort } from "../../../shared/magie.js";
import { lancerDes } from "./des.js";

const modif = (nom, valeur) => ({ nom, valeur });
/** "de Force", mais "d'Intelligence" (elision devant une voyelle). */
const de = (nom) => (/^[aeiouh]/i.test(nom) ? `d'${nom}` : `de ${nom}`);

/** Coup critique : on lance deux fois plus de des ("1d8+3" -> "2d8+3"). */
export function doublerDes(formule) {
  return formule.replace(/(\d*)d(\d+)/gi, (_, nombre, faces) => `${(Number(nombre) || 1) * 2}d${faces}`);
}

/**
 * Un d20 et ses modificateurs : la ligne principale de la fenetre.
 * Avantage / desavantage : deux d20, on garde le meilleur / le pire ;
 * l'autre est montre barre ("d20Ecarte").
 */
function ligneD20(libelle, modificateurs, lancer, avantage = "normal") {
  let d20 = lancer("1d20").total;
  let d20Ecarte = null;
  if (avantage !== "normal") {
    const second = lancer("1d20").total;
    const garde = avantage === "avantage" ? Math.max(d20, second) : Math.min(d20, second);
    d20Ecarte = garde === d20 ? second : d20;
    d20 = garde;
  }
  return {
    libelle: avantage === "normal" ? libelle : `${libelle} (${avantage})`,
    d20,
    d20Ecarte,
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
    d20Ecarte: null,
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

/**
 * Test de caracteristique ("Test de Force") ou jet de sauvegarde
 * ("Sauvegarde de Dexterite"), demande depuis le lanceur de des.
 */
export function jetTest(fiche, genre, caracteristique, classe, avantage = "normal", lancer = lancerDes) {
  const bonus = bonusDeTest(fiche, genre, caracteristique, classe);
  const nomCarac = NOMS_CARACTERISTIQUES[caracteristique];
  const modificateurs = [modif(nomCarac, bonus.modificateur)];
  if (bonus.maitrise) modificateurs.push(modif("Maitrise", bonus.maitrise));
  const nom = genre === "sauvegarde" ? `Sauvegarde ${de(nomCarac)}` : `Test ${de(nomCarac)}`;
  const ligne = ligneD20(genre === "sauvegarde" ? "Jet de sauvegarde" : "Test de caracteristique", modificateurs, lancer, avantage);
  return {
    action: { genre: "test", nom, icone: null, rarete: null, detail: genre === "sauvegarde" ? "Jet de sauvegarde" : "Test de caracteristique" },
    lignes: [ligne],
    note: ligne.critique ? "20 naturel !" : ligne.echec ? "1 naturel..." : null,
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
