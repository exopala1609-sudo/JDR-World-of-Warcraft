// Equipement : emplacements du "paper doll", et statistiques qui en decoulent.
// Fichier PARTAGE : le navigateur s'en sert pour savoir OU un objet peut etre
// depose pendant un glisser (l'emplacement s'illumine), le serveur pour
// ARBITRER et recalculer la classe d'armure. Meme code, meme verdict.
import { bonusDeMaitrise, modificateur } from "./dnd5e.js";

// Les 19 emplacements de la fiche (touche C), dans l'ordre de WoW.
export const EMPLACEMENTS = /** @type {const} */ ({
  tete: "Tete",
  cou: "Cou",
  epaules: "Epaules",
  dos: "Dos",
  torse: "Torse",
  chemise: "Chemise",
  tabard: "Tabard",
  poignets: "Poignets",
  mains: "Mains",
  taille: "Taille",
  jambes: "Jambes",
  pieds: "Pieds",
  "doigt-1": "Doigt",
  "doigt-2": "Doigt",
  "bijou-1": "Bijou",
  "bijou-2": "Bijou",
  "main-droite": "Main droite",
  "main-gauche": "Main gauche",
  distance: "A distance",
});
export const IDS_EMPLACEMENTS = Object.keys(EMPLACEMENTS);

// Ce qu'un objet du compendium peut indiquer dans son champ "emplacement".
export const TYPES_EMPLACEMENT = /** @type {const} */ ([
  "tete",
  "cou",
  "epaules",
  "dos",
  "torse",
  "chemise",
  "tabard",
  "poignets",
  "mains",
  "taille",
  "jambes",
  "pieds",
  "doigt",
  "bijou",
  "une-main",
  "deux-mains",
  "main-gauche",
  "distance",
]);

const CATEGORIES_CORPS = ["legere", "intermediaire", "lourde"];

/**
 * Le type d'emplacement d'un objet : celui ecrit dans le compendium, sinon
 * une deduction raisonnable d'apres son type. null = l'objet ne s'equipe pas.
 */
export function typeEmplacement(objet) {
  if (objet.emplacement) return objet.emplacement;
  if (objet.type === "bouclier" || objet.armure?.categorie === "bouclier") return "main-gauche";
  if (objet.type === "arme") {
    const proprietes = (objet.arme?.proprietes ?? []).join(" ").toLowerCase();
    if (proprietes.includes("munition")) return "distance";
    return proprietes.includes("deux mains") ? "deux-mains" : "une-main";
  }
  if (objet.type === "armure" && objet.armure) {
    // Une armure de 10 ou plus est un plastron ; en dessous, un accessoire
    // (cape, anneau...) dont la valeur s'AJOUTE a la classe d'armure.
    return objet.armure.classeArmure >= 10 ? "torse" : "dos";
  }
  return null;
}

/** Les emplacements de la fiche qu'un type d'emplacement peut occuper. */
export function emplacementsPour(type) {
  if (type === "doigt") return ["doigt-1", "doigt-2"];
  if (type === "bijou") return ["bijou-1", "bijou-2"];
  if (type === "une-main") return ["main-droite", "main-gauche"];
  if (type === "deux-mains") return ["main-droite"];
  return type ? [type] : [];
}

/** Cet objet peut-il aller dans cet emplacement de la fiche ? */
export function peutAllerDans(objet, emplacement) {
  return emplacementsPour(typeEmplacement(objet)).includes(emplacement);
}

/**
 * Classe d'armure selon l'equipement porte (regles D&D 5e) :
 *  - plastron (torse) : armure legere = valeur + DEX ; intermediaire =
 *    valeur + DEX (plafonnee, 2 par defaut) ; lourde = valeur seule ;
 *  - sans plastron : "caSansArmure" (10 + DEX, + la defense de la classe) ;
 *  - puis on ajoute bouclier et accessoires (cape, anneau...).
 */
export function classeArmureEquipee(equipement, caracteristiques, caSansArmure) {
  const dex = modificateur(caracteristiques.dexterite);
  const corps = equipement.torse?.armure && CATEGORIES_CORPS.includes(equipement.torse.armure.categorie) ? equipement.torse : null;
  let base = caSansArmure;
  if (corps) {
    const { classeArmure, categorie, dexteriteMax } = corps.armure;
    if (categorie === "legere") base = classeArmure + dex;
    else if (categorie === "intermediaire") base = classeArmure + Math.min(dex, dexteriteMax ?? 2);
    else base = classeArmure;
  }
  const bonus = Object.values(equipement)
    .filter((objet) => objet !== corps && objet.armure)
    .reduce((total, objet) => total + objet.armure.classeArmure, 0);
  return base + bonus;
}

/**
 * Les attaques des armes equipees : bonus au toucher (maitrise + FOR, ou DEX
 * pour une arme a distance, le meilleur des deux pour une arme de finesse)
 * et formule de degats. Calcule a la volee, jamais stocke.
 */
export function attaquesEquipees({ equipement, caracteristiques, niveau }) {
  const force = modificateur(caracteristiques.force);
  const dex = modificateur(caracteristiques.dexterite);
  return ["main-droite", "main-gauche", "distance"]
    .map((emplacement) => [emplacement, equipement[emplacement]])
    .filter(([, objet]) => objet?.arme)
    .map(([emplacement, objet]) => {
      const proprietes = objet.arme.proprietes.join(" ").toLowerCase();
      const caracteristique = emplacement === "distance" || (proprietes.includes("finesse") && dex > force) ? "dexterite" : "force";
      const mod = caracteristique === "dexterite" ? dex : force;
      return {
        emplacement,
        idObjet: objet.id,
        nom: objet.nom,
        caracteristique, // utilisee pour toucher et pour les degats
        modificateur: mod,
        bonus: bonusDeMaitrise(niveau) + mod,
        degats: mod === 0 ? objet.arme.degats : `${objet.arme.degats}${mod > 0 ? "+" : ""}${mod}`,
        typeDegats: objet.arme.typeDegats,
      };
    });
}

// --- Barre d'actions ---------------------------------------------------------------------
// Un raccourci designe un objet par sa "reference" : l'entree du compendium
// dont il vient (toutes les potions de soins se valent), sinon son identifiant.

export const TAILLE_BARRE = 12;
export const referenceObjet = (objet) => objet.source ?? objet.id;

/** Un objet merite-t-il un raccourci ? (une arme, ou un objet qui s'utilise) */
export const objetRaccourcissable = (objet) => Boolean(objet.arme || objet.soins);

/**
 * Les exemplaires d'un raccourci, dans le sac et sur le personnage.
 * @param {{ inventaire: any[], equipement?: Record<string, any> }} fiche
 * @param {string} reference
 * @returns {{ dansLeSac: any[], equipes: [string, any][] }}
 */
export function exemplairesDuRaccourci(fiche, reference) {
  const correspond = (o) => referenceObjet(o) === reference;
  return {
    dansLeSac: fiche.inventaire.filter(correspond),
    equipes: Object.entries(fiche.equipement ?? {}).filter(([, o]) => correspond(o)),
  };
}
