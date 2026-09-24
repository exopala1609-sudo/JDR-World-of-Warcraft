// Les six raretes d'objets, avec les noms et couleurs de World of Warcraft.
// Fichier PARTAGE : le serveur valide la rarete, l'interface choisira la
// couleur de bordure des icones (sacs, butin, compendium) a partir d'ici.

export const RARETES = /** @type {const} */ ({
  mediocre: { nom: "Mediocre", teinte: "gris", couleur: "#9d9d9d" },
  classique: { nom: "Classique", teinte: "blanc", couleur: "#ffffff" },
  inhabituel: { nom: "Inhabituel", teinte: "vert", couleur: "#1eff00" },
  rare: { nom: "Rare", teinte: "bleu", couleur: "#0070dd" },
  epique: { nom: "Epique", teinte: "violet", couleur: "#a335ee" },
  legendaire: { nom: "Legendaire", teinte: "orange", couleur: "#ff8000" },
});

export const CLES_RARETES = /** @type {(keyof typeof RARETES)[]} */ (Object.keys(RARETES));
