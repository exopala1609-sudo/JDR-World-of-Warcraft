// Migrations : convertir les fiches enregistrees avec un ancien format.
//
// Pourquoi ? Tes sauvegardes vivent des mois dans ton dossier cloud, alors que
// le code evolue a chaque sprint. Quand le format d'une fiche change, le serveur
// "met a niveau" les anciennes fiches a leur lecture, au lieu de les rejeter.
// Chaque etape convertit une version vers la suivante (1 -> 2, puis 2 -> 3...).

// Sprint 1 : les raretes portaient d'autres noms.
const ANCIENNES_RARETES = {
  pauvre: "mediocre",
  commun: "classique",
  "peu-commun": "inhabituel",
  rare: "rare",
  epique: "epique",
  legendaire: "legendaire",
};

// Sprint 1 : une ressource ne connaissait qu'un seul moment de recuperation.
const ANCIENNES_RECUPERATIONS = {
  "repos-court": { reposCourt: "remplir", reposLong: "remplir" },
  "repos-long": { reposCourt: "aucun", reposLong: "remplir" },
  aucune: { reposCourt: "aucun", reposLong: "aucun" },
};

// Sprint 1 : noms techniques des ressources de depart. La "rage" du Barbare
// (ses utilisations par jour) devient "rage-barbare", pour laisser le nom
// "rage" a la jauge de Rage facon WoW : deux ressources bien distinctes.
const ANCIENNES_RESSOURCES = {
  rage: { cle: "rage-barbare", nom: "Rages (utilisations)", apparence: "rage" },
  "emplacements-niveau-1": { apparence: "emplacement-sort" },
  "inspiration-bardique": { apparence: "inspiration" },
};

const ETAPES = {
  // Version 1 (sprint 1) -> version 2 (sprint 2)
  1: (fiche) => ({
    ...fiche,
    versionSchema: 2,
    ressources: (fiche.ressources ?? []).map(({ recuperation, ...ressource }) => ({
      ...ressource,
      type: "compteur",
      ...(ANCIENNES_RECUPERATIONS[recuperation] ?? ANCIENNES_RECUPERATIONS.aucune),
      apparence: ressource.cle,
      ...ANCIENNES_RESSOURCES[ressource.cle],
    })),
    inventaire: (fiche.inventaire ?? []).map((objet) => ({
      ...objet,
      source: null,
      type: "objet",
      rarete: ANCIENNES_RARETES[objet.rarete] ?? "classique",
      valeur: 0,
      empilable: false,
    })),
    grimoire: [],
    etats: [],
  }),

  // Version 2 (sprints 2 a 5) -> version 3 (sprint 6 : ecran de creation).
  // Les fiches existantes n'ont ni race, ni faction, ni portrait choisi :
  // on les laisse vides (null), le MJ pourra les completer plus tard.
  2: (fiche) => ({
    ...fiche,
    versionSchema: 3,
    race: fiche.race ?? null,
    faction: fiche.faction ?? null,
    portrait: fiche.portrait ?? null,
  }),
};

/**
 * Amene une fiche brute (lue sur le disque) jusqu'a la version actuelle.
 * Renvoie { fiche, migree } : migree = true si une conversion a eu lieu.
 */
export function migrerPersonnage(brut) {
  if (!brut || typeof brut !== "object") return { fiche: brut, migree: false };
  let fiche = brut;
  let version = fiche.versionSchema ?? 1; // les fiches du sprint 1 n'avaient pas de numero
  let migree = false;
  while (ETAPES[version]) {
    fiche = ETAPES[version](fiche);
    version = fiche.versionSchema;
    migree = true;
  }
  return { fiche, migree };
}
