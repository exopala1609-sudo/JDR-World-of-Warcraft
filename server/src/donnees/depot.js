// Le "depot" : la memoire du jeu et sa sauvegarde sur disque.
//
// Organisation dans le dossier synchronise (VTT_ASSETS/parties) :
//
//   parties/
//   └── t-3f9a0c1b2d/              <- une table (session de jeu)
//       ├── table.json             <- nom, date de creation
//       ├── combat.json            <- present seulement pendant un combat
//       ├── scene.json             <- carte, grille, pions, brouillard
//       ├── personnages/
//       │   ├── p-8e21aa04c7.json  <- UN fichier par personnage
//       │   └── p-51c0d9e3f2.json
//       └── corbeille/             <- personnages supprimes (recuperables)
//
// Pourquoi un fichier par personnage ? Si le cloud rencontre un conflit, il
// ne touche qu'une fiche, pas toute la partie. Et tu peux ouvrir une fiche
// dans le Bloc-notes pour la lire ou la corriger a la main.
//
// Fonctionnement : au demarrage, tout est lu en memoire (c'est instantane
// a l'echelle d'une campagne). Ensuite le jeu travaille en memoire, et chaque
// modification est recopiee sur le disque ~1/4 de seconde plus tard.
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ecrireJsonAtomique, lireJson } from "../fichiers.js";
import { SchemaCombat } from "../modeles/combat.js";
import { migrerPersonnage } from "../modeles/migrations.js";
import { SchemaPersonnage } from "../modeles/personnage.js";
import { SchemaScene, sceneVide } from "../modeles/scene.js";
import { SchemaTable } from "../modeles/table.js";

const DELAI_ECRITURE_MS = 250;
// La scene change tres souvent (pinceau du brouillard, pions qui glissent) :
// on l'ecrit au plus une fois par seconde pour menager la synchro du cloud.
const DELAI_ECRITURE_SCENE_MS = 1000;

export function creerDepot(dossierParties) {
  /** @type {Map<string, object>} */ const tables = new Map();
  /** @type {Map<string, object>} */ const personnages = new Map();
  /** @type {Map<string, object>} */ const combats = new Map(); // idTable -> combat
  /** @type {Map<string, object>} */ const scenes = new Map(); // idTable -> scene
  /** @type {Map<string, {minuterie: NodeJS.Timeout, donnees: object}>} */
  const ecrituresEnAttente = new Map();

  const cheminTable = (idTable) => join(dossierParties, idTable);
  const cheminFicheTable = (idTable) => join(cheminTable(idTable), "table.json");
  const cheminPersonnage = (p) => join(cheminTable(p.idTable), "personnages", `${p.id}.json`);
  const cheminCombat = (idTable) => join(cheminTable(idTable), "combat.json");
  const cheminScene = (idTable) => join(cheminTable(idTable), "scene.json");

  function annulerEcriture(chemin) {
    const attente = ecrituresEnAttente.get(chemin);
    if (attente) {
      clearTimeout(attente.minuterie);
      ecrituresEnAttente.delete(chemin);
    }
  }

  // Regroupe les ecritures rapprochees (ex. 5 degats en 1 seconde = 1 ecriture).
  function planifierEcriture(chemin, donnees, delai = DELAI_ECRITURE_MS) {
    const existante = ecrituresEnAttente.get(chemin);
    if (existante) clearTimeout(existante.minuterie);
    const minuterie = setTimeout(() => {
      ecrituresEnAttente.delete(chemin);
      try {
        ecrireJsonAtomique(chemin, donnees);
      } catch (erreur) {
        console.error(`[depot] Echec d'ecriture de ${chemin} : ${erreur.message}`);
      }
    }, delai);
    ecrituresEnAttente.set(chemin, { minuterie, donnees });
  }

  function lireDossier(chemin) {
    try {
      return readdirSync(chemin, { withFileTypes: true });
    } catch {
      return [];
    }
  }

  return {
    /** Lit toutes les tables et fiches presentes sur le disque. */
    charger() {
      mkdirSync(dossierParties, { recursive: true });
      const ignores = [];
      let migrees = 0;

      for (const entree of lireDossier(dossierParties)) {
        if (!entree.isDirectory()) continue;
        const brut = lireJson(cheminFicheTable(entree.name));
        const table = SchemaTable.safeParse(brut);
        if (!table.success || table.data.id !== entree.name) {
          if (brut) ignores.push(cheminFicheTable(entree.name));
          continue;
        }
        tables.set(table.data.id, table.data);

        const dossierPersos = join(cheminTable(table.data.id), "personnages");
        for (const fichier of lireDossier(dossierPersos)) {
          if (!fichier.isFile() || !fichier.name.endsWith(".json")) continue;
          const chemin = join(dossierPersos, fichier.name);
          // Une fiche d'un ancien format est d'abord mise a niveau.
          const { fiche, migree } = migrerPersonnage(lireJson(chemin));
          const perso = SchemaPersonnage.safeParse(fiche);
          if (perso.success && perso.data.idTable === table.data.id) {
            personnages.set(perso.data.id, perso.data);
            if (migree) {
              migrees += 1;
              planifierEcriture(chemin, perso.data); // on enregistre la version a jour
            }
          } else {
            ignores.push(chemin);
          }
        }

        // La scene (carte, pions, brouillard) de la table.
        const brutScene = lireJson(cheminScene(table.data.id));
        if (brutScene) {
          const scene = SchemaScene.safeParse(brutScene);
          if (scene.success && scene.data.idTable === table.data.id) scenes.set(table.data.id, scene.data);
          else ignores.push(cheminScene(table.data.id));
        }

        // Combat en cours au moment de l'arret ? On le reprend.
        const brutCombat = lireJson(cheminCombat(table.data.id));
        if (brutCombat) {
          const combat = SchemaCombat.safeParse(brutCombat);
          if (combat.success && combat.data.idTable === table.data.id) combats.set(table.data.id, combat.data);
          else ignores.push(cheminCombat(table.data.id));
        }
      }

      // Un fichier abime (conflit cloud, edition manuelle ratee) est ignore,
      // jamais supprime : on le signale pour que le MJ puisse le reparer.
      for (const chemin of ignores) console.warn(`[depot] Fichier invalide ignore : ${chemin}`);
      return {
        tables: tables.size,
        personnages: personnages.size,
        combats: combats.size,
        migrees,
        ignores: ignores.length,
      };
    },

    // --- Tables ------------------------------------------------------------
    listerTables() {
      return [...tables.values()].sort((a, b) => a.creeLe.localeCompare(b.creeLe));
    },
    obtenirTable(idTable) {
      return tables.get(idTable) ?? null;
    },
    enregistrerTable(table) {
      tables.set(table.id, table);
      planifierEcriture(cheminFicheTable(table.id), table);
      return table;
    },

    // --- Personnages -------------------------------------------------------
    personnagesDeLaTable(idTable) {
      return [...personnages.values()].filter((p) => p.idTable === idTable);
    },
    obtenirPersonnage(idPersonnage) {
      return personnages.get(idPersonnage) ?? null;
    },
    /** Valide puis enregistre : une fiche invalide n'atteint jamais le disque. */
    enregistrerPersonnage(personnage) {
      const valide = SchemaPersonnage.parse({ ...personnage, modifieLe: new Date().toISOString() });
      personnages.set(valide.id, valide);
      planifierEcriture(cheminPersonnage(valide), valide);
      return valide;
    },
    /** Deplace la fiche dans la corbeille de la table au lieu de l'effacer. */
    supprimerPersonnage(idPersonnage) {
      const personnage = personnages.get(idPersonnage);
      if (!personnage) return null;
      personnages.delete(idPersonnage);

      const chemin = cheminPersonnage(personnage);
      annulerEcriture(chemin);
      const corbeille = join(cheminTable(personnage.idTable), "corbeille");
      mkdirSync(corbeille, { recursive: true });
      const destination = join(corbeille, `${personnage.id}-${Date.now()}.json`);
      if (existsSync(chemin)) renameSync(chemin, destination);
      else ecrireJsonAtomique(destination, personnage);
      return personnage;
    },

    // --- Scenes -------------------------------------------------------------
    /** Toute table a une scene : une scene vide est creee a la premiere demande. */
    obtenirScene(idTable) {
      if (!scenes.has(idTable)) scenes.set(idTable, sceneVide(idTable));
      return scenes.get(idTable);
    },
    /**
     * Enregistre la scene. "valider = false" pour les changements tres
     * frequents deja verifies un par un (traits de brouillard), afin de ne pas
     * re-verifier des milliers de traits a chaque coup de pinceau.
     */
    enregistrerScene(scene, { valider = true } = {}) {
      const aJour = valider ? SchemaScene.parse(scene) : scene;
      scenes.set(aJour.idTable, aJour);
      planifierEcriture(cheminScene(aJour.idTable), aJour, DELAI_ECRITURE_SCENE_MS);
      return aJour;
    },

    // --- Combats ------------------------------------------------------------
    obtenirCombat(idTable) {
      return combats.get(idTable) ?? null;
    },
    enregistrerCombat(combat) {
      const valide = SchemaCombat.parse(combat);
      combats.set(valide.idTable, valide);
      planifierEcriture(cheminCombat(valide.idTable), valide);
      return valide;
    },
    /** Fin du combat : le fichier combat.json disparait. */
    supprimerCombat(idTable) {
      combats.delete(idTable);
      const chemin = cheminCombat(idTable);
      annulerEcriture(chemin);
      try {
        unlinkSync(chemin);
      } catch {
        /* pas encore ecrit sur le disque : rien a effacer */
      }
    },

    /** Ecrit immediatement tout ce qui est en attente (a l'arret du serveur). */
    vider() {
      for (const [chemin, { minuterie, donnees }] of ecrituresEnAttente) {
        clearTimeout(minuterie);
        try {
          ecrireJsonAtomique(chemin, donnees);
        } catch (erreur) {
          console.error(`[depot] Echec d'ecriture de ${chemin} : ${erreur.message}`);
        }
      }
      ecrituresEnAttente.clear();
    },
  };
}
