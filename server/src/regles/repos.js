// Repos court et repos long, selon le Manuel des joueurs (D&D 5e).
//
// REPOS COURT (1 heure) : le personnage peut depenser des des de vie. Pour
//   chaque de : on lance le de + modificateur de Constitution (minimum 0),
//   et on recupere autant de PV. Puis chaque ressource applique sa regle
//   "reposCourt".
// REPOS LONG (8 heures) : PV au maximum, PV temporaires perdus, on recupere
//   la moitie de ses des de vie (au moins 1), puis chaque ressource applique
//   sa regle "reposLong".
import { modificateur } from "../../../shared/dnd5e.js";
import { lancerDes } from "./des.js";
import { ErreurRegle } from "./erreurs.js";
import { reposDesRessources } from "./ressources.js";

export function reposCourt(personnage, nombreDeDes, lancer = lancerDes) {
  if (!Number.isInteger(nombreDeDes) || nombreDeDes < 0) {
    throw new ErreurRegle("Le nombre de des de vie doit etre un entier positif.");
  }
  if (nombreDeDes > personnage.desDeVie.restants) {
    throw new ErreurRegle(`Il ne reste que ${personnage.desDeVie.restants} de(s) de vie.`);
  }

  const modCon = modificateur(personnage.caracteristiques.constitution);
  const jets = [];
  for (let i = 0; i < nombreDeDes; i++) {
    const de = lancer(`1d${personnage.desDeVie.faces}`).total;
    jets.push({ de, gain: Math.max(0, de + modCon) });
  }
  const gainTotal = jets.reduce((somme, jet) => somme + jet.gain, 0);

  const pv = personnage.pointsDeVie;
  const actuels = Math.min(pv.max, pv.actuels + gainTotal);
  const { ressources, changements } = reposDesRessources(personnage.ressources, "court");

  return {
    personnage: {
      ...personnage,
      pointsDeVie: { ...pv, actuels },
      desDeVie: { ...personnage.desDeVie, restants: personnage.desDeVie.restants - nombreDeDes },
      ressources,
    },
    detail: {
      repos: "court",
      desDepenses: nombreDeDes,
      faces: personnage.desDeVie.faces,
      modificateurConstitution: modCon,
      jets,
      pvRecuperes: actuels - pv.actuels,
      ressources: changements,
    },
  };
}

export function reposLong(personnage) {
  const pv = personnage.pointsDeVie;
  const dv = personnage.desDeVie;
  const desRecuperables = Math.max(1, Math.floor(personnage.niveau / 2));
  const restants = Math.min(personnage.niveau, dv.restants + desRecuperables);
  const { ressources, changements } = reposDesRessources(personnage.ressources, "long");

  return {
    personnage: {
      ...personnage,
      pointsDeVie: { max: pv.max, actuels: pv.max, temporaires: 0 },
      desDeVie: { ...dv, restants },
      ressources,
    },
    detail: {
      repos: "long",
      pvRecuperes: pv.max - pv.actuels,
      pvTemporairesPerdus: pv.temporaires,
      desDeVieRecuperes: restants - dv.restants,
      ressources: changements,
    },
  };
}
