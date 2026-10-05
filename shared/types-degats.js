// Les types de degats et leur couleur dans les textes de combat flottants
// (au-dessus des pions), facon World of Warcraft : rouge pour le feu, vert
// pour le poison, blanc pour les coups physiques...
//
// Le "type" d'un degat est ecrit dans le compendium (sorts : "degats.type",
// armes : "arme.typeDegats", monstres : "attaques[].type"). Les accents et les
// majuscules ne comptent pas ("Necrotique" = "nécrotique").

export const TYPES_DEGATS = {
  // Physiques : blanc
  contondant: { nom: "Contondant", couleur: "#ffffff" },
  perforant: { nom: "Perforant", couleur: "#ffffff" },
  tranchant: { nom: "Tranchant", couleur: "#ffffff" },
  // Elements
  feu: { nom: "Feu", couleur: "#ff3b1f" },
  froid: { nom: "Froid", couleur: "#69d2ff" },
  foudre: { nom: "Foudre", couleur: "#7fa8ff" },
  tonnerre: { nom: "Tonnerre", couleur: "#b9a6ff" },
  acide: { nom: "Acide", couleur: "#b4ff2e" },
  poison: { nom: "Poison", couleur: "#2fd84a" },
  // Magie
  necrotique: { nom: "Necrotique", couleur: "#a26bd6" },
  radiant: { nom: "Radiant", couleur: "#ffe36e" },
  force: { nom: "Force", couleur: "#f08cff" },
  psychique: { nom: "Psychique", couleur: "#ff74c8" },
};

/** Couleur des soins (vert vif) et d'un type inconnu (blanc, comme un coup physique). */
export const COULEUR_SOINS = "#3cff3c";
export const COULEUR_PAR_DEFAUT = "#ffffff";

/** "Nécrotique" -> "necrotique". */
export const normaliserTypeDegats = (type) =>
  String(type ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export function couleurDegats(type) {
  return TYPES_DEGATS[normaliserTypeDegats(type)]?.couleur ?? COULEUR_PAR_DEFAUT;
}
