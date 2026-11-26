// Les copies de secours des parties : un "appareil photo" du dossier parties/.
//
// Une copie est un simple dossier, lisible dans l'explorateur de fichiers :
//
//   sauvegardes/
//   ├── 2026-11-25_20h05m33_demarrage/     <- photo prise au lancement du serveur
//   │   └── t-3f9a0c1b2d/ ...              <- les tables, telles quelles
//   ├── 2026-11-25_21h05m33_en-jeu/        <- une par heure, si la partie a bouge
//   └── ...
//
// Quand ? Au demarrage (AVANT que le serveur ne touche a quoi que ce soit), puis
// toutes les heures tant que quelque chose a change. Les 30 plus recentes sont
// gardees : de quoi revenir plusieurs seances en arriere.
//
// Restaurer : npm run restaurer (voir docs/SAUVEGARDES.md).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

export const COPIES_GARDEES = 30;
export const INTERVALLE_COPIES_MS = 60 * 60 * 1000; // une heure

// Une table : t-xxxxxxxxxx. Seuls ces dossiers sont copies et restaures : rien
// d'autre (verrou, fichiers poses a la main) n'est jamais touche.
const MOTIF_TABLE = /^t-[0-9a-f]{10}$/;
// Les fichiers communs a toutes les tables, copies et restaures avec elles.
export const FICHIERS_COMMUNS = ["comptes.json"];
// Une copie : 2026-11-25_20h05m33_raison. Seuls ces dossiers sont supprimes
// par le menage : un dossier range a la main dans sauvegardes/ est respecte.
const MOTIF_COPIE = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})h(\d{2})m(\d{2})_([a-z0-9-]+)$/;

const deuxChiffres = (n) => String(n).padStart(2, "0");

/** "2026-11-25_20h05m33_demarrage" (heure locale du serveur, sans ":" interdit sous Windows). */
export function nomDeCopie(date, raison) {
  const jour = `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;
  const heure = `${deuxChiffres(date.getHours())}h${deuxChiffres(date.getMinutes())}m${deuxChiffres(date.getSeconds())}`;
  return `${jour}_${heure}_${raison}`;
}

const tablesDe = (dossier) => {
  try {
    return readdirSync(dossier, { withFileTypes: true }).filter((e) => e.isDirectory() && MOTIF_TABLE.test(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
};

// Fichiers temporaires d'une ecriture en cours : sans interet dans une copie.
const aCopier = (chemin) => !/\.tmp-\d+$/.test(chemin);

/** Les copies existantes, de la plus recente a la plus ancienne. */
export function listerCopies(dossierSauvegardes) {
  let entrees = [];
  try {
    entrees = readdirSync(dossierSauvegardes, { withFileTypes: true });
  } catch {
    return [];
  }
  return entrees
    .filter((e) => e.isDirectory() && MOTIF_COPIE.test(e.name))
    .map((e) => {
      const [, an, mois, jour, h, min, sec, raison] = MOTIF_COPIE.exec(e.name);
      const chemin = join(dossierSauvegardes, e.name);
      return { nom: e.name, chemin, raison, libelle: `${jour}/${mois}/${an} a ${h}:${min}:${sec}`, tables: tablesDe(chemin).length };
    })
    .sort((a, b) => b.nom.localeCompare(a.nom));
}

/**
 * Prend une copie de toutes les tables du dossier parties/. Renvoie son nom,
 * ou null s'il n'y avait aucune table a copier. Les copies en trop (au-dela
 * de "garder") sont ensuite supprimees, les plus anciennes d'abord.
 */
export function creerCopie(dossierParties, dossierSauvegardes, raison, { maintenant = new Date(), garder = COPIES_GARDEES } = {}) {
  const tables = tablesDe(dossierParties);
  if (tables.length === 0) return null;

  let nom = nomDeCopie(maintenant, raison);
  // Deux copies dans la meme seconde (tests, double clic) : on numerote.
  for (let n = 2; existsSync(join(dossierSauvegardes, nom)); n++) nom = `${nomDeCopie(maintenant, raison)}-${n}`;
  const destination = join(dossierSauvegardes, nom);
  mkdirSync(destination, { recursive: true });
  for (const table of tables) {
    cpSync(join(dossierParties, table), join(destination, table), { recursive: true, filter: aCopier });
  }
  for (const fichier of FICHIERS_COMMUNS) {
    if (existsSync(join(dossierParties, fichier))) cpSync(join(dossierParties, fichier), join(destination, fichier));
  }

  for (const ancienne of listerCopies(dossierSauvegardes).slice(garder)) rmSync(ancienne.chemin, { recursive: true, force: true });
  return nom;
}

/**
 * Remet les tables dans l'etat d'une copie. A faire serveur ARRETE (le script
 * npm run restaurer le verifie). Les tables actuelles sont remplacees ; une
 * table creee APRES la copie est supprimee, comme si on remontait le temps.
 * L'appelant prend d'abord une copie de l'etat actuel : rien n'est perdu.
 */
export function restaurerCopie(dossierParties, cheminCopie) {
  const tables = tablesDe(cheminCopie);
  if (tables.length === 0) throw new Error("cette copie ne contient aucune table.");
  for (const table of tablesDe(dossierParties)) rmSync(join(dossierParties, table), { recursive: true, force: true });
  mkdirSync(dossierParties, { recursive: true });
  for (const table of tables) cpSync(join(cheminCopie, table), join(dossierParties, table), { recursive: true });
  // Les comptes reviennent aussi a l'etat de la copie (une copie d'avant le
  // lot 2 n'en a pas : on garde alors les comptes actuels).
  for (const fichier of FICHIERS_COMMUNS) {
    if (existsSync(join(cheminCopie, fichier))) cpSync(join(cheminCopie, fichier), join(dossierParties, fichier));
  }
  return tables.length;
}

/**
 * Une copie toutes les heures pendant que le serveur tourne, mais seulement si
 * la partie a change depuis la precedente (un serveur allume toute la semaine
 * sur le NAS ne remplit pas le disque de copies identiques).
 * Renvoie la fonction qui arrete le minuteur.
 */
export function planifierCopies({ depot, dossierParties, dossierSauvegardes, intervalleMs = INTERVALLE_COPIES_MS }) {
  let dernierCompteur = depot.compteurModifications();
  const minuterie = setInterval(() => {
    const compteur = depot.compteurModifications();
    if (compteur === dernierCompteur) return;
    dernierCompteur = compteur;
    try {
      depot.vider(); // tout ce qui est en attente part d'abord sur le disque
      const nom = creerCopie(dossierParties, dossierSauvegardes, "en-jeu");
      if (nom) console.log(`[sauvegardes] Copie de secours : ${nom}`);
    } catch (erreur) {
      console.error(`[sauvegardes] !! Copie de secours impossible : ${erreur.message}`);
    }
  }, intervalleMs);
  minuterie.unref();
  return () => clearInterval(minuterie);
}
