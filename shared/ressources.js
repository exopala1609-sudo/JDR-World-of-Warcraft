// Ressources de classe : jauges (Mana, Rage, Energie...) et compteurs
// (Eclats d'ame, emplacements de sort...).
//
// Chaque ressource d'un personnage porte SES PROPRES regles de repos :
//   reposCourt / reposLong = "aucun"   rien ne change
//                          | "remplir" retour au maximum
//                          | "vider"   retour a 0 (ex. la Rage de WoW)
//                          | "moitie"  recupere la moitie du maximum
//                          | { "ajouter": 2 }  recupere un nombre fixe
// Ainsi, le code des repos n'a pas besoin de connaitre chaque classe :
// il applique la regle ecrite sur la ressource. Une ressource inventee
// demain par le module WoW fonctionnera sans toucher au code.
//
// "type" et "apparence" ne servent qu'a l'affichage :
//   type      = "jauge" (une barre) ou "compteur" (des pastilles)
//   apparence = identifiant visuel (couleur de barre, icone) pour l'interface

export const MODES_REPOS = /** @type {const} */ (["aucun", "remplir", "vider", "moitie"]);
export const TYPES_RESSOURCE = /** @type {const} */ (["jauge", "compteur"]);

/**
 * Modeles de ressources facon World of Warcraft, que le MJ peut ajouter a un
 * personnage. Valeurs provisoires en attendant le module officiel : le MJ
 * ajuste le maximum a l'ajout, et peut tout redefinir dans la fiche.
 */
export const MODELES_RESSOURCES = /** @type {const} */ ({
  mana: { nom: "Mana", type: "jauge", max: 100, reposCourt: "moitie", reposLong: "remplir", apparence: "mana" },
  rage: { nom: "Rage", type: "jauge", max: 100, reposCourt: "vider", reposLong: "vider", apparence: "rage" },
  energie: { nom: "Energie", type: "jauge", max: 100, reposCourt: "remplir", reposLong: "remplir", apparence: "energie" },
  focalisation: {
    nom: "Focalisation",
    type: "jauge",
    max: 100,
    reposCourt: "remplir",
    reposLong: "remplir",
    apparence: "focalisation",
  },
  "puissance-runique": {
    nom: "Puissance runique",
    type: "jauge",
    max: 100,
    reposCourt: "vider",
    reposLong: "vider",
    apparence: "puissance-runique",
  },
  "eclats-ame": {
    nom: "Eclats d'ame",
    type: "compteur",
    max: 5,
    reposCourt: "aucun",
    reposLong: "remplir",
    apparence: "eclats-ame",
  },
  "points-combo": {
    nom: "Points de combo",
    type: "compteur",
    max: 5,
    reposCourt: "vider",
    reposLong: "vider",
    apparence: "points-combo",
  },
  "puissance-sacree": {
    nom: "Puissance sacree",
    type: "compteur",
    max: 5,
    reposCourt: "vider",
    reposLong: "vider",
    apparence: "puissance-sacree",
  },
});
