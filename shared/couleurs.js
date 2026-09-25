// Couleurs attribuees aux joueurs : fichier PARTAGE.
// Le serveur colore les pions avec ; le navigateur colore les traces et les
// pings avec, SANS attendre le serveur (il connait deja la couleur de chacun).

// Couleur stable par joueur : le meme pseudo donne toujours la meme couleur.
export const COULEURS_JOUEURS = ["#1f77b4", "#2ca02c", "#9467bd", "#ff7f0e", "#17becf", "#e377c2", "#bcbd22", "#8c564b"];
export const COULEUR_PNJ = "#b22222";
export const COULEUR_MJ = "#ffd100"; // l'or de l'interface : le MJ se reconnait tout de suite

/** Couleur d'un joueur d'apres son pseudo (null = PNJ du MJ). */
export function couleurPour(proprietaire) {
  if (proprietaire === null) return COULEUR_PNJ;
  let somme = 0;
  for (const lettre of proprietaire.toLocaleLowerCase("fr")) somme = (somme * 31 + lettre.charCodeAt(0)) % 1_000_003;
  return COULEURS_JOUEURS[somme % COULEURS_JOUEURS.length];
}

/** Couleur des traces et des pings d'une personne connectee. */
export function couleurDe(profil) {
  return profil.role === "mj" ? COULEUR_MJ : couleurPour(profil.pseudo);
}

// Couleurs proposees pour les traces tactiques (en plus de la sienne).
export const PALETTE_TRACES = ["#ffffff", "#ff3b30", "#ff9500", "#ffd100", "#34c759", "#32d7ff", "#2f7bff", "#b04dff"];
