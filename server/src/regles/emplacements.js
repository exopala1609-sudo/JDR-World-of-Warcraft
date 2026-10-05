// Emplacements de sorts : lancer un sort de niveau 1 ou plus "eteint" un
// emplacement du niveau choisi (le niveau du sort, ou plus haut pour le
// renforcer). Le repos long les rallume (regle "reposLong" de la ressource).
import { cleEmplacement, emplacementsDuPersonnage } from "../../../shared/magie.js";
import { ErreurRegle } from "./erreurs.js";

/**
 * Depense un emplacement de niveau "niveau". Renvoie les ressources a jour.
 * Si le personnage n'a pas encore de ressource pour ce niveau (la table D&D lui
 * en donne, mais il n'en a jamais depense), elle est creee.
 */
export function depenserEmplacement(personnage, niveau, classe = null) {
  const emplacement = emplacementsDuPersonnage(personnage, classe).find((e) => e.niveau === niveau);
  if (!emplacement || emplacement.max === 0) throw new ErreurRegle(`${personnage.nom} n'a pas d'emplacement de sort de niveau ${niveau}.`);
  if (emplacement.actuel <= 0) throw new ErreurRegle(`${personnage.nom} n'a plus d'emplacement de niveau ${niveau} (repos long pour les recuperer).`);
  const cle = cleEmplacement(niveau);
  const existante = personnage.ressources.find((r) => r.cle === cle);
  // (le maximum suit la table D&D si le personnage a gagne des emplacements en montant de niveau)
  if (existante) return personnage.ressources.map((r) => (r.cle === cle ? { ...r, max: emplacement.max, actuel: emplacement.actuel - 1 } : r));
  return [
    ...personnage.ressources,
    {
      cle,
      nom: `Emplacements de sort (niv. ${niveau})`,
      type: "compteur",
      actuel: emplacement.max - 1,
      max: emplacement.max,
      reposCourt: "aucun",
      reposLong: "remplir",
      apparence: "emplacement-sort",
    },
  ];
}
