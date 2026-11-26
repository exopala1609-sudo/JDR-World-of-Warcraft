// Resolution d'une action (attaque, sort) : le serveur lance les des et
// DETAILLE chaque terme, pour que la fenetre de resolution puisse afficher
// "De (14) + Force (+3) + Maitrise (+2) = 19". Fonctions PURES : le lancer de
// des est passe en parametre (un "faux de" dans les tests).
import { bonusDeMaitrise, bonusDeTest, modificateur } from "../../../shared/dnd5e.js";
import { NOMS_CARACTERISTIQUES } from "../../../shared/creation.js";
import { caracteristiqueIncantation, formuleAuNiveau, resolutionDuSort } from "../../../shared/magie.js";
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
  const termes = jet.termes.filter((t) => t.type === "des");
  const des = termes.flatMap((t) => t.gardes.map((i) => t.jets[i]));
  return {
    libelle,
    d20: null,
    d20Ecarte: null,
    des: { formule, jets: des, total: jet.total, faces: Math.max(0, ...termes.map((t) => t.faces)) },
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
export function jetArme(fiche, attaque, objet, lancer = lancerDes, avantage = "normal") {
  const maitrise = bonusDeMaitrise(fiche.niveau);
  const toucher = ligneD20(
    "Jet d'attaque",
    [modif(NOMS_CARACTERISTIQUES[attaque.caracteristique], attaque.modificateur), modif("Maitrise", maitrise)],
    lancer,
    avantage,
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
 * Des libres du lanceur de des ("2d6+2", "2d20kh1+3"). Un d20 seul (avec ou
 * sans avantage) s'affiche comme un jet d'attaque : grand d20, critique sur 20 ;
 * sinon une ligne "Des (2d6) + Bonus = total".
 */
export function jetLibre(formule, raison, lancer = lancerDes) {
  const r = lancer(formule);
  const des = r.termes.filter((t) => t.type === "des");
  const bonus = r.termes.filter((t) => t.type === "bonus").reduce((s, t) => s + t.valeur, 0);
  const modificateurs = bonus ? [modif("Bonus", bonus)] : [];
  const unD20 = des.length === 1 && des[0].faces === 20 && des[0].gardes.length === 1 && des[0].jets.length <= 2 && des[0].valeur > 0;
  let ligne;
  if (unD20) {
    const t = des[0];
    const garde = t.jets[t.gardes[0]];
    const ecarte = t.jets.length === 2 ? t.jets[t.gardes[0] === 0 ? 1 : 0] : null;
    ligne = { libelle: raison || "Jet de d20", d20: garde, d20Ecarte: ecarte, des: null, modificateurs, total: r.total, critique: garde === 20, echec: garde === 1 };
  } else {
    const jets = des.flatMap((t) => t.gardes.map((i) => (t.valeur < 0 ? -t.jets[i] : t.jets[i])));
    const total = des.reduce((s, t) => s + t.valeur, 0);
    const formuleDes = des.map((t) => t.expression).join("").replace(/^\+/, "");
    ligne = {
      libelle: raison || "Resultat",
      d20: null,
      d20Ecarte: null,
      des: { formule: formuleDes, jets, total, faces: Math.max(0, ...des.map((t) => t.faces)) },
      modificateurs,
      total: r.total,
      critique: false,
      echec: false,
    };
  }
  return {
    action: { genre: "des", nom: raison || "Jet de des", icone: null, rarete: null, detail: r.formule },
    lignes: [ligne],
    note: null,
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

/**
 * Attaque d'un monstre (bestiaire) : d20 + son bonus au toucher, puis ses
 * degats (la formule du bestiaire inclut deja son bonus, ex. "1d6+2").
 * 20 naturel : des de degats doubles ; 1 naturel : rate.
 */
export function jetAttaqueMonstre(fiche, attaque, lancer = lancerDes, avantage = "normal") {
  const toucher = ligneD20("Jet d'attaque", [modif("Toucher", attaque.toucher)], lancer, avantage);
  // "1d6+2" : les des d'un cote, le bonus fixe de l'autre (affiche a part ;
  // un critique ne double que les des, comme dans les regles).
  const [, des, bonus] = attaque.degats.replace(/\s+/g, "").match(/^(.*?)((?:[+-]\d+)*)$/);
  const constante = (bonus.match(/[+-]\d+/g) ?? []).reduce((t, n) => t + Number(n), 0);
  const formuleDes = des || attaque.degats;
  const formule = toucher.critique ? doublerDes(formuleDes) : formuleDes;
  const degats = ligneDes(`Degats${attaque.type ? ` (${attaque.type})` : ""}`, formule, des && constante ? [modif("Bonus", constante)] : [], lancer);
  return {
    action: { genre: "arme", nom: attaque.nom, icone: null, rarete: null, detail: `Attaque - ${fiche.nom}` },
    lignes: toucher.echec ? [toucher] : [toucher, degats],
    note: toucher.critique ? "Coup critique : les des de degats sont doubles." : toucher.echec ? "Echec critique : l'attaque rate." : null,
  };
}

/**
 * Lancer un sort du grimoire. "classe" : l'entree du referentiel (caracteristique
 * d'incantation). "niveauLance" : le niveau de l'emplacement utilise (upcast :
 * plus haut que le sort, ses degats / soins grossissent de "parNiveauSuperieur").
 */
export function jetSort(fiche, sort, classe, lancer = lancerDes, niveauLance = sort.niveau) {
  const enPlus = sort.niveau > 0 ? Math.max(0, niveauLance - sort.niveau) : 0;
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
    const base = formuleAuNiveau(sort.degats.formule, sort.parNiveauSuperieur, enPlus);
    const formule = critique ? doublerDes(base) : base;
    lignes.push(ligneDes(`Degats (${sort.degats.type})`, formule, [], lancer));
  }
  if (sort.soins) {
    const soins = sort.degats ? sort.soins : formuleAuNiveau(sort.soins, sort.parNiveauSuperieur, enPlus);
    lignes.push(ligneDes("Soins", soins, [modif(nomCarac, mod)], lancer));
  }
  if (enPlus > 0) note = [`Lance au niveau ${niveauLance} (+${enPlus}).`, note].filter(Boolean).join(" ");
  return { action: actionSort(sort, niveauLance), lignes, note };
}

function actionSort(sort, niveauLance = sort.niveau) {
  return {
    genre: "sort",
    nom: sort.nom,
    icone: sort.icone ?? sort.source ?? null,
    rarete: null,
    detail:
      sort.niveau === 0
        ? `Sort mineur - ${sort.ecole}`
        : `Sort de niveau ${sort.niveau}${niveauLance > sort.niveau ? ` lance au niveau ${niveauLance}` : ""} - ${sort.ecole}`,
  };
}
