// Le compendium : la bibliotheque de sorts, d'objets et d'auras du MJ,
// ecrite dans des fichiers JSON du dossier compendium/ (dans ton cloud).
//
// - Le serveur lit TOUS les fichiers .json du dossier (et de ses sous-dossiers).
// - Une entree mal ecrite est signalee (fichier + position + raison) et ignoree ;
//   les autres entrees du fichier restent disponibles.
// - Apres avoir modifie un fichier, le MJ clique sur "Recharger le compendium" :
//   pas besoin de redemarrer le serveur. (On ne surveille pas le dossier
//   automatiquement : sur un disque Google Drive, cette surveillance n'est pas fiable.)
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { ETATS_DE_BASE } from "../../../shared/etats.js";
import { lireTexteJson } from "../fichiers.js";
import { SchemaDefinitionEtat, SchemaEntreeObjet, SchemaEntreeSort } from "../modeles/compendium.js";
import { nouvelId } from "../modeles/identifiants.js";

const SECTIONS = {
  objets: SchemaEntreeObjet,
  sorts: SchemaEntreeSort,
  etats: SchemaDefinitionEtat,
};

function fichiersJson(dossier) {
  if (!existsSync(dossier)) return [];
  const resultat = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith(".") || entree.name.startsWith("~")) continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) resultat.push(...fichiersJson(chemin));
    else if (entree.isFile() && entree.name.toLowerCase().endsWith(".json")) resultat.push(chemin);
  }
  return resultat.sort();
}

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

export function creerCompendium(dossier) {
  let objets = new Map();
  let sorts = new Map();
  let etats = new Map();

  function charger() {
    const nouveaux = { objets: new Map(), sorts: new Map(), etats: new Map() };
    const erreurs = [];
    const signaler = (fichier, emplacement, message) =>
      erreurs.push({ fichier: relative(dossier, fichier), emplacement, message });

    for (const fichier of fichiersJson(dossier)) {
      let contenu;
      try {
        contenu = lireTexteJson(fichier);
      } catch (erreur) {
        signaler(fichier, "fichier", `JSON illisible : ${erreur.message}`);
        continue;
      }
      if (!contenu || typeof contenu !== "object" || Array.isArray(contenu)) {
        signaler(fichier, "fichier", 'Le fichier doit contenir { "objets": [...], "sorts": [...], "etats": [...] }.');
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
          }
        });
      }
    }

    // On ne remplace l'ancien contenu qu'une fois la lecture terminee.
    ({ objets, sorts, etats } = nouveaux);
    return { objets: objets.size, sorts: sorts.size, etats: etats.size, erreurs };
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
      sorts: [...sorts.values()],
      etats: toutesLesDefinitionsEtat(),
    }),
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
