// Application des regles D&D 5e sur les points de vie.
// Fonction "pure" : elle recoit l'etat actuel et renvoie le nouvel etat,
// sans rien modifier d'autre. C'est ce qui la rend simple a tester.
import { TYPES_PV } from "../../../shared/protocole.js";
import { ErreurRegle } from "./erreurs.js";

export function appliquerPointsDeVie(pv, type, montant) {
  if (!Number.isInteger(montant) || montant < 0 || montant > 10_000) {
    throw new ErreurRegle("Le montant doit etre un nombre entier positif.");
  }

  const nouveau = { ...pv };
  const detail = { type, montant };

  switch (type) {
    case TYPES_PV.DEGATS: {
      // Les points de vie temporaires encaissent les degats en premier.
      const absorbes = Math.min(nouveau.temporaires, montant);
      nouveau.temporaires -= absorbes;
      nouveau.actuels = Math.max(0, nouveau.actuels - (montant - absorbes));
      detail.absorbesParTemporaires = absorbes;
      break;
    }
    case TYPES_PV.SOINS:
      // On ne peut jamais depasser son maximum.
      nouveau.actuels = Math.min(nouveau.max, nouveau.actuels + montant);
      break;
    case TYPES_PV.TEMPORAIRES:
      // Les PV temporaires ne se cumulent pas : on garde le plus eleve.
      nouveau.temporaires = Math.max(nouveau.temporaires, montant);
      break;
    default:
      throw new ErreurRegle(`Type de modification inconnu : "${type}".`);
  }

  detail.variation = nouveau.actuels - pv.actuels;
  detail.aTerre = nouveau.actuels === 0;
  return { pointsDeVie: nouveau, detail };
}
