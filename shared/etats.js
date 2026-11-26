// Etats ("auras" dans le vocabulaire de WoW) qu'on peut poser sur un personnage.
//
// Chaque etat a :
//   nature = "buff" (benefique) ou "debuff" (nefaste) : dans WoW, les buffs et
//            les debuffs s'affichent dans deux rangees distinctes, avec des
//            bordures differentes ;
//   icone  = identifiant visuel. L'interface affichera l'image
//            icones/<icone>.png de ton dossier (ou un carre gris si elle
//            n'existe pas encore).
//
// Ici : les 14 conditions officielles de D&D 5e, codees en dur.
// Tes auras personnalisees (En feu, Benediction...) s'ajoutent dans le
// compendium, sans toucher au code (section "etats" d'un fichier JSON).

export const NATURES_ETAT = /** @type {const} */ (["buff", "debuff"]);

export const ETATS_DE_BASE = /** @type {const} */ ({
  aveugle: { nom: "Aveugle", nature: "debuff", description: "Echoue aux tests de vue ; attaques contre lui avec avantage, les siennes avec desavantage." },
  charme: { nom: "Charme", nature: "debuff", description: "Ne peut pas attaquer celui qui l'a charme." },
  assourdi: { nom: "Assourdi", nature: "debuff", description: "N'entend plus ; echoue aux tests d'ouie." },
  effraye: { nom: "Effraye", nature: "debuff", description: "Desavantage tant que la source de sa peur est en vue ; ne peut pas s'en approcher." },
  agrippe: { nom: "Agrippe", nature: "debuff", description: "Sa vitesse tombe a 0." },
  neutralise: { nom: "Neutralise", nature: "debuff", description: "Ne peut effectuer ni action ni reaction." },
  invisible: { nom: "Invisible", nature: "buff", description: "Ses attaques ont l'avantage, celles qui le visent le desavantage." },
  paralyse: { nom: "Paralyse", nature: "debuff", description: "Neutralise, immobile ; tout coup au corps a corps est critique." },
  petrifie: { nom: "Petrifie", nature: "debuff", description: "Change en pierre ; resistance a tous les degats." },
  empoisonne: { nom: "Empoisonne", nature: "debuff", description: "Desavantage aux jets d'attaque et aux tests de caracteristique." },
  "a-terre": { nom: "A terre", nature: "debuff", description: "Rampe ; desavantage a ses attaques." },
  entrave: { nom: "Entrave", nature: "debuff", description: "Vitesse 0 ; desavantage a ses attaques et jets de DEX." },
  etourdi: { nom: "Etourdi", nature: "debuff", description: "Neutralise ; echoue aux jets de FOR et DEX." },
  inconscient: { nom: "Inconscient", nature: "debuff", description: "Neutralise, a terre, ne percoit plus rien." },
  // Pas une condition : l'aura posee d'elle-meme quand on lance un sort a
  // concentration (un seul a la fois : le suivant remplace le precedent).
  concentration: {
    nom: "Concentration",
    nature: "buff",
    icone: "Spell_Arcane_MindMastery",
    description: "Maintient un sort. Subir des degats impose un jet de sauvegarde de Constitution (DD 10 ou la moitie des degats).",
  },
});
