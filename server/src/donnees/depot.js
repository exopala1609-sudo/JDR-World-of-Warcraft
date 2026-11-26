// Le "depot" : la memoire du jeu et sa sauvegarde sur disque.
//
// Organisation dans le dossier synchronise (VTT_ASSETS/parties) :
//
//   parties/
//   └── t-3f9a0c1b2d/              <- une table (session de jeu)
//       ├── table.json             <- nom, date de creation
//       ├── combat.json            <- present seulement pendant un combat
//       ├── quetes.json            <- le journal de quetes du groupe
//       ├── notes.json             <- les carnets PRIVES (un par participant)
//       ├── scene.json             <- carte, grille, pions, brouillard
//       ├── personnages/
//       │   ├── p-8e21aa04c7.json  <- UN fichier par personnage
//       │   └── p-51c0d9e3f2.json
//       ├── corbeille/             <- personnages supprimes (recuperables)
//       └── abimes/                <- fichiers illisibles mis de cote (voir plus bas)
//
// Pourquoi un fichier par personnage ? Si le cloud rencontre un conflit, il
// ne touche qu'une fiche, pas toute la partie. Et tu peux ouvrir une fiche
// dans le Bloc-notes pour la lire ou la corriger a la main.
//
// Fonctionnement : au demarrage, tout est lu en memoire (c'est instantane
// a l'echelle d'une campagne). Ensuite le jeu travaille en memoire, et chaque
// modification est recopiee sur le disque ~1/4 de seconde plus tard.
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { ecrireJsonAtomique, lireJson, lireTexteJson } from "../fichiers.js";
import { SchemaCombat } from "../modeles/combat.js";
import { SchemaJournalQuetes } from "../modeles/quete.js";
import { SchemaCarnets } from "../modeles/note.js";
import { migrerPersonnage } from "../modeles/migrations.js";
import { SchemaPersonnage } from "../modeles/personnage.js";
import { SchemaScene, sceneVide } from "../modeles/scene.js";
import { SchemaTable } from "../modeles/table.js";

const DELAI_ECRITURE_MS = 250;
const MOTIF_TABLE = /^t-[0-9a-f]{10}$/;
// La scene change tres souvent (pinceau du brouillard, pions qui glissent) :
// on l'ecrit au plus une fois par seconde pour menager la synchro du cloud.
const DELAI_ECRITURE_SCENE_MS = 1000;

export function creerDepot(dossierParties) {
  /** @type {Map<string, object>} */ const tables = new Map();
  /** @type {Map<string, object>} */ const personnages = new Map();
  /** @type {Map<string, object>} */ const combats = new Map(); // idTable -> combat
  /** @type {Map<string, object[]>} */ const quetes = new Map(); // idTable -> quetes
  /** @type {Map<string, Record<string, object[]>>} */ const carnets = new Map(); // idTable -> { auteur: notes }
  /** @type {Map<string, object>} */ const scenes = new Map(); // idTable -> scene
  /** @type {Map<string, {minuterie: NodeJS.Timeout, donnees: object}>} */
  const ecrituresEnAttente = new Map();
  // Ce que le MJ doit savoir des fichiers abimes trouves au chargement.
  /** @type {{idTable: string | null, texte: string, misDeCote?: boolean, rappel?: boolean}[]} */
  const alertes = [];
  // Fichiers abimes qu'on n'a PAS reussi a mettre de cote : le serveur ne doit
  // jamais ecrire par-dessus (ce serait les effacer).
  const cheminsProteges = new Set();
  // Augmente a chaque modification : les copies de secours horaires ne se
  // font que si la partie a bouge.
  let modifications = 0;

  const cheminTable = (idTable) => join(dossierParties, idTable);
  const cheminFicheTable = (idTable) => join(cheminTable(idTable), "table.json");
  const cheminPersonnage = (p) => join(cheminTable(p.idTable), "personnages", `${p.id}.json`);
  const cheminCombat = (idTable) => join(cheminTable(idTable), "combat.json");
  const cheminQuetes = (idTable) => join(cheminTable(idTable), "quetes.json");
  const cheminNotes = (idTable) => join(cheminTable(idTable), "notes.json");
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
    modifications += 1;
    if (cheminsProteges.has(chemin)) {
      console.error(`[depot] !! ${chemin} est abime et n'a pas pu etre mis de cote : il n'est PAS remplace. Les changements de ce fichier ne sont pas sauvegardes.`);
      return;
    }
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

  /**
   * Lit un fichier de la table (scene, quetes...). Distingue "absent" (normal :
   * rien n'a encore ete fait) d'"illisible" (JSON casse) : un fichier casse ne
   * doit surtout pas etre pris pour un fichier absent, puis remplace.
   */
  function lireDocument(chemin) {
    if (!existsSync(chemin)) return { etat: "absent" };
    try {
      return { etat: "ok", donnees: lireTexteJson(chemin) };
    } catch (erreur) {
      return { etat: "illisible", message: erreur.message };
    }
  }

  /**
   * Un fichier abime (conflit du cloud, edition a la main ratee, ancien format)
   * est DEPLACE dans le dossier abimes/ de sa table, avec la date. Sans cela,
   * la premiere modification en jeu l'ecraserait par une version vide.
   * Le MJ en est averti a son entree dans la table.
   */
  function mettreDeCote(idTable, chemin, raison) {
    const nom = basename(chemin, ".json");
    const destination = join(cheminTable(idTable), "abimes", `${nom}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const lisible = (c) => relative(dossierParties, c);
    try {
      mkdirSync(join(cheminTable(idTable), "abimes"), { recursive: true });
      renameSync(chemin, destination);
      console.warn(`[depot] !! ${lisible(chemin)} est abime (${raison}) : mis de cote dans ${lisible(destination)}.`);
      alertes.push({
        idTable,
        misDeCote: true,
        texte: `Fichier abime mis de cote : ${lisible(chemin)} (${raison}). Il a ete deplace dans ${lisible(destination)}. Voir docs/SAUVEGARDES.md pour le recuperer.`,
      });
    } catch (erreur) {
      cheminsProteges.add(chemin);
      console.error(`[depot] !! ${lisible(chemin)} est abime et n'a pas pu etre deplace (${erreur.message}) : il ne sera pas modifie.`);
      alertes.push({
        idTable,
        texte: `Fichier abime : ${lisible(chemin)} (${raison}). Il n'a pas pu etre mis de cote : ses changements ne seront pas sauvegardes avant reparation. Voir docs/SAUVEGARDES.md.`,
      });
    }
  }

  /** Lit et valide un fichier de la table ; s'il est abime, le met de cote. Renvoie les donnees valides ou null. */
  function chargerDocument(idTable, chemin, schema) {
    const lu = lireDocument(chemin);
    if (lu.etat === "absent") return null;
    if (lu.etat === "illisible") {
      mettreDeCote(idTable, chemin, "JSON illisible");
      return null;
    }
    const valide = schema.safeParse(lu.donnees);
    if (!valide.success || valide.data.idTable !== idTable) {
      mettreDeCote(idTable, chemin, valide.success ? "il appartient a une autre table" : "format inattendu");
      return null;
    }
    return valide.data;
  }

  return {
    /** Lit toutes les tables et fiches presentes sur le disque. */
    charger() {
      mkdirSync(dossierParties, { recursive: true });
      const ignores = [];
      let migrees = 0;
      const alertesAvant = alertes.length;

      for (const entree of lireDossier(dossierParties)) {
        if (!entree.isDirectory()) continue;
        const brut = lireJson(cheminFicheTable(entree.name));
        const table = SchemaTable.safeParse(brut);
        if (!table.success || table.data.id !== entree.name) {
          // Table illisible : rien n'y sera ecrit (elle n'est pas chargee), on previent.
          if (MOTIF_TABLE.test(entree.name) && existsSync(cheminFicheTable(entree.name))) {
            ignores.push(cheminFicheTable(entree.name));
            alertes.push({ idTable: null, texte: `Table ignoree : ${entree.name}/table.json est abime. Ses fichiers sont intacts ; voir docs/SAUVEGARDES.md.` });
          }
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
            // Fiche abimee : laissee en place (aucune autre fiche ne porte ce
            // nom, elle ne sera pas ecrasee), le MJ peut la corriger et relancer.
            ignores.push(chemin);
            alertes.push({ idTable: table.data.id, texte: `Personnage ignore : ${relative(dossierParties, chemin)} est abime. Corrige-le ou restaure une copie (docs/SAUVEGARDES.md).` });
          }
        }

        // La scene (carte, pions, brouillard), le journal de quetes, les carnets
        // prives, et un combat en cours au moment de l'arret (on le reprend).
        const id = table.data.id;
        const scene = chargerDocument(id, cheminScene(id), SchemaScene);
        if (scene) scenes.set(id, scene);
        const journal = chargerDocument(id, cheminQuetes(id), SchemaJournalQuetes);
        if (journal) quetes.set(id, journal.quetes);
        const lu = chargerDocument(id, cheminNotes(id), SchemaCarnets);
        if (lu) carnets.set(id, lu.carnets);
        const combat = chargerDocument(id, cheminCombat(id), SchemaCombat);
        if (combat) combats.set(id, combat);

        // Des fichiers mis de cote lors d'un lancement precedent attendent
        // toujours d'etre examines : on le rappelle au MJ a chaque lancement,
        // tant qu'il n'a pas vide le dossier abimes/.
        const misDeCote = alertes.filter((x) => x.idTable === id && x.misDeCote).length;
        const enAttente = lireDossier(join(cheminTable(id), "abimes")).filter((f) => f.isFile()).length - misDeCote;
        if (enAttente > 0) {
          alertes.push({
            idTable: id,
            texte: `${enAttente} fichier(s) abime(s) attendent dans ${id}/abimes/ (mis de cote lors d'un lancement precedent). Voir docs/SAUVEGARDES.md, puis vide ce dossier.`,
            rappel: true,
          });
        }
      }

      // Un fichier abime n'est jamais supprime ni ecrase : il est signale (et,
      // pour la scene, les quetes, les carnets et le combat, mis de cote).
      for (const chemin of ignores) console.warn(`[depot] Fichier invalide ignore : ${chemin}`);
      return {
        tables: tables.size,
        personnages: personnages.size,
        combats: combats.size,
        migrees,
        ignores: alertes.slice(alertesAvant).filter((x) => !x.rappel).length, // tables, fiches et fichiers abimes de CE lancement
      };
    },

    /** Les problemes de fichiers trouves au chargement : pour cette table, plus ceux qui ne concernent aucune table. */
    alertes(idTable) {
      return alertes.filter((a) => a.idTable === idTable || a.idTable === null).map((a) => a.texte);
    },

    /** Change a chaque modification (pour ne copier la partie que si elle a bouge). */
    compteurModifications() {
      return modifications;
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
      modifications += 1;
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

    // --- Carnets de notes (prives : un par auteur) ------------------------------
    obtenirNotes(idTable, auteur) {
      return carnets.get(idTable)?.[auteur] ?? [];
    },
    enregistrerNotes(idTable, auteur, liste) {
      const tous = { ...(carnets.get(idTable) ?? {}), [auteur]: liste };
      const valide = SchemaCarnets.parse({ idTable, carnets: tous });
      carnets.set(idTable, valide.carnets);
      planifierEcriture(cheminNotes(idTable), valide);
      return valide.carnets[auteur];
    },

    // --- Quetes -------------------------------------------------------------
    obtenirQuetes(idTable) {
      return quetes.get(idTable) ?? [];
    },
    enregistrerQuetes(idTable, liste) {
      const valide = SchemaJournalQuetes.parse({ idTable, quetes: liste });
      quetes.set(idTable, valide.quetes);
      planifierEcriture(cheminQuetes(idTable), valide);
      return valide.quetes;
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
      modifications += 1;
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
