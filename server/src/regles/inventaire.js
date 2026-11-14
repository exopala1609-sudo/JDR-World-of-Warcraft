// Le sac d'un personnage : ranger et sortir des objets. Fonctions PURES.
import { nouvelId } from "../modeles/identifiants.js";
import { ErreurRegle } from "./erreurs.js";

export const QUANTITE_MAX = 9999;

/**
 * Range un exemplaire dans le sac. Les objets empilables (potions, fleches)
 * rejoignent la pile de la meme origine ; les autres prennent une case.
 */
export function ajouterAuSac(inventaire, exemplaire) {
  const pile = exemplaire.empilable && exemplaire.source && inventaire.find((o) => o.source === exemplaire.source);
  if (!pile) return [...inventaire, exemplaire];
  return inventaire.map((o) => (o === pile ? { ...o, quantite: Math.min(QUANTITE_MAX, o.quantite + exemplaire.quantite) } : o));
}

/**
 * Sort UN exemplaire d'un objet du sac (le reste de la pile y reste).
 * Renvoie { inventaire, exemplaire } ; l'exemplaire sorti a quantite 1.
 */
export function sortirUn(inventaire, idObjet) {
  const objet = inventaire.find((o) => o.id === idObjet);
  if (!objet) throw new ErreurRegle("Cet objet n'est plus dans le sac.");
  if (objet.quantite <= 1) return { inventaire: inventaire.filter((o) => o.id !== idObjet), exemplaire: objet };
  return {
    inventaire: inventaire.map((o) => (o.id === idObjet ? { ...o, quantite: o.quantite - 1 } : o)),
    exemplaire: { ...objet, id: nouvelId("o"), quantite: 1 },
  };
}
