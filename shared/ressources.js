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

// Les MODELES de ressources (Mana, Rage, Energie...) vivent dans le referentiel :
// fichier ressources.json du dossier referentiel/ (modifiable au Bloc-notes).
