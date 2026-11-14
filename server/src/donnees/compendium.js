// Le compendium : la bibliotheque de sorts, d'objets et d'auras du MJ,
// ecrite dans des fichiers JSON du dossier compendium/ (dans ton cloud).
//
// - Le serveur lit TOUS les fichiers .json du dossier (et de ses sous-dossiers).
// - Une entree mal ecrite est signalee (fichier + position + raison) et ignoree ;
//   les autres entrees du fichier restent disponibles.
// - Apres avoir modifie un fichier, le MJ clique sur "Recharger le compendium" :
//   pas besoin de redemarrer le serveur. (On ne surveille pas le dossier
//   automatiquement : sur un disque Google Drive, cette surveillance n'est pas fiable.)
import { copyFileSync, existsSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { ETATS_DE_BASE } from "../../../shared/etats.js";
import { lireJsonCommente, listerFichiersJson as fichiersJson } from "../fichiers.js";
import { SchemaDefinitionEtat, SchemaEntreeMonstre, SchemaEntreeObjet, SchemaEntreeSort } from "../modeles/compendium.js";
import { nouvelId } from "../modeles/identifiants.js";

const SECTIONS = {
  objets: SchemaEntreeObjet,
  sorts: SchemaEntreeSort,
  etats: SchemaDefinitionEtat,
  monstres: SchemaEntreeMonstre, // le bestiaire du MJ
};

/**
 * Premier lancement : si le dossier ne contient aucun fichier JSON, on y copie
 * les fichiers d'exemple du projet (donnees de test, a remplacer par les tiennes).
 */
export function installerExemples(dossierCompendium, dossierExemples) {
  // Dossier absent = chemin du .env probablement faux : on ne cree rien.
  if (!existsSync(dossierCompendium) || !existsSync(dossierExemples)) return [];
  if (fichiersJson(dossierCompendium).length > 0) return [];
  const copies = [];
  for (const chemin of fichiersJson(dossierExemples)) {
    copyFileSync(chemin, join(dossierCompendium, basename(chemin)));
    copies.push(basename(chemin));
  }
  return copies;
}

/**
 * Un fichier d'exemple ajoute par une mise a jour (ex. le bestiaire) : on le
 * depose dans un compendium DEJA rempli, s'il n'y est pas encore. Rien n'est
 * jamais ecrase.
 */
export function installerFichierExemple(dossierCompendium, cheminExemple) {
  const destination = join(dossierCompendium, basename(cheminExemple));
  if (!existsSync(dossierCompendium) || !existsSync(cheminExemple) || existsSync(destination)) return false;
  copyFileSync(cheminExemple, destination);
  return true;
}

/** Le fichier ou le jeu ecrit les monstres crees depuis le Bestiaire (dans compendium/). */
export const FICHIER_MONSTRES_MJ = "mes-monstres.json";
/** Le fichier ou le jeu ecrit les sorts crees ou modifies depuis le Compendium. */
export const FICHIER_SORTS_MJ = "mes-sorts.json";
/**
 * Le fichier ou le jeu ecrit les icones choisies depuis le Compendium :
 * { "objets": { "epee-longue": "INV_Sword_04" }, "sorts": { ... } }. Il
 * l'emporte sur le champ "icone" des autres fichiers (jamais reecrits).
 */
export const FICHIER_ICONES_MJ = "mes-icones.json";
const NOM_ICONE = /^[A-Za-z0-9_-]{1,80}$/;

export function creerCompendium(dossier) {
  let objets = new Map();
  let sorts = new Map();
  let etats = new Map();
  let monstres = new Map();
  let fichierDuMonstre = new Map(); // id -> fichier (relatif) ou il est ecrit
  let fichierDuSort = new Map();

  function charger() {
    const origines = new Map();
    const originesSorts = new Map();
    const nouveaux = { objets: new Map(), sorts: new Map(), etats: new Map(), monstres: new Map() };
    const erreurs = [];
    const signaler = (fichier, emplacement, message) =>
      erreurs.push({ fichier: relative(dossier, fichier), emplacement, message });

    for (const fichier of fichiersJson(dossier)) {
      if (relative(dossier, fichier) === FICHIER_ICONES_MJ) continue; // lu a part, a la fin
      let contenu;
      try {
        contenu = lireJsonCommente(fichier);
      } catch (erreur) {
        signaler(fichier, "fichier", erreur.message);
        continue;
      }
      if (!contenu || typeof contenu !== "object" || Array.isArray(contenu)) {
        signaler(fichier, "fichier", 'Le fichier doit contenir { "objets": [...], "sorts": [...], "etats": [...], "monstres": [...] }.');
        continue;
      }

      for (const cle of Object.keys(contenu)) {
        if (!SECTIONS[cle]) signaler(fichier, cle, `Section inconnue (attendu : ${Object.keys(SECTIONS).join(", ")}).`);
      }

      for (const [section, schema] of Object.entries(SECTIONS)) {
        const liste = contenu[section];
        if (liste === undefined) continue;
        if (!Array.isArray(liste)) {
          signaler(fichier, section, "Doit etre une liste [ ... ].");
          continue;
        }
        liste.forEach((brut, index) => {
          const emplacement = `${section}[${index}]${brut?.id ? ` (${brut.id})` : ""}`;
          const resultat = schema.safeParse(brut);
          if (!resultat.success) {
            const message = resultat.error.issues
              .map((i) => (i.path.length ? `${i.path.join(".")} : ${i.message}` : i.message))
              .join(" ; ");
            signaler(fichier, emplacement, message);
          } else if (nouveaux[section].has(resultat.data.id)) {
            signaler(fichier, emplacement, "Identifiant deja utilise par une autre entree : ignoree.");
          } else if (section === "etats" && ETATS_DE_BASE[resultat.data.id]) {
            signaler(fichier, emplacement, "Cet identifiant est deja un etat officiel de D&D 5e.");
          } else {
            nouveaux[section].set(resultat.data.id, resultat.data);
            if (section === "monstres") origines.set(resultat.data.id, relative(dossier, fichier));
            if (section === "sorts") originesSorts.set(resultat.data.id, relative(dossier, fichier));
          }
        });
      }
    }

    // Les icones choisies depuis le jeu (mes-icones.json) remplacent celles des fichiers.
    const choix = lireChoixIcones(signaler);
    for (const section of ["objets", "sorts"]) {
      for (const [id, icone] of Object.entries(choix[section])) {
        const entree = nouveaux[section].get(id);
        if (entree) nouveaux[section].set(id, { ...entree, icone });
      }
    }

    // On ne remplace l'ancien contenu qu'une fois la lecture terminee.
    ({ objets, sorts, etats, monstres } = nouveaux);
    fichierDuMonstre = origines;
    fichierDuSort = originesSorts;
    return { objets: objets.size, sorts: sorts.size, etats: etats.size, monstres: monstres.size, erreurs };
  }

  /** Les icones choisies depuis le jeu, telles qu'ecrites dans mes-icones.json (valides seulement). */
  function lireChoixIcones(signaler = () => {}) {
    const choix = { objets: {}, sorts: {} };
    const fichier = join(dossier, FICHIER_ICONES_MJ);
    if (!existsSync(fichier)) return choix;
    let contenu;
    try {
      contenu = lireJsonCommente(fichier);
    } catch (erreur) {
      signaler(fichier, "fichier", erreur.message);
      return choix;
    }
    for (const section of ["objets", "sorts"]) {
      for (const [id, icone] of Object.entries(contenu?.[section] ?? {})) {
        if (typeof icone === "string" && NOM_ICONE.test(icone)) choix[section][id] = icone;
        else signaler(fichier, `${section}.${id}`, "Nom d'icone invalide (lettres, chiffres, _ et - seulement).");
      }
    }
    return choix;
  }

  /** Etats disponibles : les conditions officielles + les auras du compendium. */
  function toutesLesDefinitionsEtat() {
    const base = Object.entries(ETATS_DE_BASE).map(([cle, def]) => ({ cle, icone: cle, ...def, officiel: true }));
    const perso = [...etats.values()].map(({ id, ...def }) => ({ cle: id, icone: id, ...def, officiel: false }));
    return [...base, ...perso];
  }

  return {
    charger,
    lister: () => ({
      objets: [...objets.values()],
      // "modifiable" : ecrit dans mes-sorts.json (cree depuis le jeu), donc modifiable depuis le jeu.
      sorts: [...sorts.values()].map((s) => ({ ...s, modifiable: fichierDuSort.get(s.id) === FICHIER_SORTS_MJ })),
      etats: toutesLesDefinitionsEtat(),
      // "modifiable" : cree depuis le jeu (mes-monstres.json), donc modifiable depuis le jeu.
      monstres: [...monstres.values()].map((m) => ({ ...m, modifiable: fichierDuMonstre.get(m.id) === FICHIER_MONSTRES_MJ })),
    }),
    fichierDuMonstre: (id) => fichierDuMonstre.get(id) ?? null,
    fichierDuSort: (id) => fichierDuSort.get(id) ?? null,
    dossier,
    obtenirMonstre: (id) => monstres.get(id) ?? null,
    lireChoixIcones,
    obtenirObjet: (id) => objets.get(id) ?? null,
    obtenirSort: (id) => sorts.get(id) ?? null,
    obtenirDefinitionEtat: (cle) => toutesLesDefinitionsEtat().find((d) => d.cle === cle) ?? null,
  };
}

/** Copie d'une entree du compendium, prete a aller dans un sac. */
export function instancierObjet({ id, ...entree }, quantite) {
  return { id: nouvelId("o"), source: id, quantite, ...entree };
}

/** Copie d'un sort du compendium, prete a aller dans un grimoire. */
export function instancierSort({ id, ...entree }) {
  return { id: nouvelId("s"), source: id, ...entree };
}
