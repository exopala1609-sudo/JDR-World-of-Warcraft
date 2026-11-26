// Equiper et desequiper : deplacer un objet entre le sac et la fiche.
// Fonctions PURES : elles recoivent une fiche et en renvoient une nouvelle.
// Le recalcul de la classe d'armure se fait ensuite (voir shared/equipement.js).
import { classeArmureSansArmure } from "../../../shared/creation.js";
import { classeArmureEquipee, emplacementsPour, EMPLACEMENTS, typeEmplacement } from "../../../shared/equipement.js";
import { ErreurRegle } from "./erreurs.js";
import { ajouterAuSac, sortirUn } from "./inventaire.js";

/**
 * Equipe un objet du sac. "emplacementDemande" : l'emplacement ou le joueur
 * l'a depose (absent = le premier libre, comme un clic droit dans WoW).
 * Ce qui occupait la place retourne dans le sac, ainsi que ce qui devient
 * incompatible (une arme a deux mains libere la main gauche, et inversement).
 */
export function equiper(fiche, idObjet, emplacementDemande) {
  const objet = fiche.inventaire.find((o) => o.id === idObjet);
  if (!objet) throw new ErreurRegle("Cet objet n'est plus dans le sac.");
  const type = typeEmplacement(objet);
  const possibles = emplacementsPour(type);
  if (!possibles.length) throw new ErreurRegle(`${objet.nom} ne s'equipe pas.`);
  const emplacement = emplacementDemande ?? possibles.find((e) => !fiche.equipement[e]) ?? possibles[0];
  if (!possibles.includes(emplacement)) {
    throw new ErreurRegle(`${objet.nom} ne se porte pas a cet emplacement (${EMPLACEMENTS[emplacement] ?? emplacement}).`);
  }

  const sortie = sortirUn(fiche.inventaire, idObjet);
  let inventaire = sortie.inventaire;
  const equipement = { ...fiche.equipement };
  const aRanger = [emplacement];
  if (type === "deux-mains") aRanger.push("main-gauche");
  if (emplacement === "main-gauche" && equipement["main-droite"] && typeEmplacement(equipement["main-droite"]) === "deux-mains") {
    aRanger.push("main-droite");
  }
  const ranges = [];
  for (const place of aRanger) {
    if (!equipement[place]) continue;
    ranges.push(equipement[place].nom);
    inventaire = ajouterAuSac(inventaire, equipement[place]);
    delete equipement[place];
  }
  equipement[emplacement] = sortie.exemplaire;
  return { fiche: { ...fiche, inventaire, equipement }, detail: { nom: objet.nom, emplacement, ranges } };
}

/** Retire l'objet d'un emplacement et le range dans le sac. */
export function desequiper(fiche, emplacement) {
  const objet = fiche.equipement[emplacement];
  if (!objet) throw new ErreurRegle("Cet emplacement est deja vide.");
  const { [emplacement]: _retire, ...equipement } = fiche.equipement;
  return {
    fiche: { ...fiche, equipement, inventaire: ajouterAuSac(fiche.inventaire, objet) },
    detail: { nom: objet.nom, emplacement },
  };
}

/**
 * Classe d'armure d'une fiche d'apres son equipement. "classe" : l'entree
 * du referentiel (pour la defense sans armure du Moine, du Barbare...).
 */
export function recalculerClasseArmure(fiche, classe) {
  const sansArmure = classe
    ? classeArmureSansArmure(classe, fiche.caracteristiques)
    : 10 + Math.floor((fiche.caracteristiques.dexterite - 10) / 2);
  return { ...fiche, classeArmure: Math.max(1, Math.min(40, classeArmureEquipee(fiche.equipement, fiche.caracteristiques, sansArmure))) };
}
