// Le referentiel : factions, races, classes, ressources et regles de creation,
// ecrits dans les fichiers JSON du dossier referentiel/ (dans ton cloud).
//
// Meme fonctionnement que le compendium :
// - le serveur lit TOUS les fichiers .json du dossier (sous-dossiers compris) ;
// - une entree mal ecrite est signalee (fichier + position + raison) et ignoree,
//   les autres restent disponibles ;
// - le MJ peut recharger les fichiers sans relancer le serveur.
//
// Difference avec le compendium : le referentiel est PUBLIC. Les joueurs en
// ont besoin pour creer leur personnage (il ne contient aucun secret du MJ).
import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { lireJsonCommente, listerFichiersJson } from "../fichiers.js";
import {
  REGLES_CREATION_PAR_DEFAUT,
  SchemaClasse,
  SchemaDon,
  SchemaFaction,
  SchemaFactionRenommee,
  SchemaHistorique,
  SchemaLangue,
  SchemaModeleRessource,
  SchemaRace,
  SchemaReglesCreation,
} from "../modeles/referentiel.js";

// Les sections "liste" d'un fichier, et le schema de chacune de leurs entrees.
const LISTES = {
  factions: SchemaFaction,
  races: SchemaRace,
  classes: SchemaClasse,
  historiques: SchemaHistorique,
  dons: SchemaDon,
  ressources: SchemaModeleRessource,
  langues: SchemaLangue,
  renommees: SchemaFactionRenommee,
};
const SECTIONS = [...Object.keys(LISTES), "creation"];

const messageZod = (erreur) =>
  erreur.issues.map((i) => (i.path.length ? `${i.path.join(".")} : ${i.message}` : i.message)).join(" ; ");

/**
 * Premier lancement : si le dossier ne contient aucun fichier JSON, on y copie
 * les fichiers d'exemple du projet (JSON + mode d'emploi en texte).
 */
export function installerExemplesReferentiel(dossierReferentiel, dossierExemples) {
  if (!existsSync(dossierReferentiel) || !existsSync(dossierExemples)) return [];
  if (listerFichiersJson(dossierReferentiel).length > 0) return [];
  const copies = [];
  for (const entree of readdirSync(dossierExemples, { withFileTypes: true })) {
    if (!entree.isFile() || entree.name.startsWith(".")) continue;
    copyFileSync(join(dossierExemples, entree.name), join(dossierReferentiel, entree.name));
    copies.push(entree.name);
  }
  return copies.sort();
}

/** Situe une erreur : "referentiel/races.json > races[1] (nain)", ou "referentiel > races". */
export function situerErreur({ fichier, emplacement }) {
  return `referentiel${fichier ? `/${fichier}` : ""} > ${emplacement}`;
}

/** Une ligne de bilan, ex. "2 faction(s), 14 race(s), 16 classe(s), 16 ressource(s)". */
export function resumerReferentiel(rapport) {
  const creation = rapport.creationPersonnalisee ? "" : " - regles de creation officielles par defaut";
  return (
    `${rapport.factions} faction(s), ${rapport.races} race(s), ${rapport.classes} classe(s), ` +
    `${rapport.historiques ?? 0} historique(s), ${rapport.dons ?? 0} don(s), ${rapport.langues ?? 0} langue(s), ${rapport.renommees ?? 0} faction(s) de renommee, ${rapport.ressources} ressource(s)${creation}`
  );
}

export function creerReferentiel(dossier) {
  let contenu = vide();

  function vide() {
    return {
      factions: new Map(),
      races: new Map(),
      classes: new Map(),
      historiques: new Map(),
      dons: new Map(),
      ressources: new Map(),
      langues: new Map(),
      renommees: new Map(),
      creation: REGLES_CREATION_PAR_DEFAUT,
    };
  }

  function charger() {
    const nouveau = vide();
    const erreurs = [];
    let fichierCreation = null;
    const signaler = (fichier, emplacement, message) =>
      erreurs.push({ fichier: fichier ? relative(dossier, fichier) : "", emplacement, message });
    const origine = new Map(); // "races:nain" -> fichier, pour situer les erreurs de liens
    // Identifiants d'entrees deja signalees comme fautives : une race qui cite
    // une classe fautive ne declenche pas une seconde erreur "classe inconnue"
    // (une seule faute de frappe ne doit pas noyer le MJ sous 15 messages).
    const dejaSignales = new Set();

    // --- 1. Lecture de chaque fichier, entree par entree ----------------------
    for (const fichier of listerFichiersJson(dossier)) {
      let donnees;
      try {
        donnees = lireJsonCommente(fichier);
      } catch (erreur) {
        signaler(fichier, "fichier", erreur.message);
        for (const [, id] of readFileSync(fichier, "utf8").matchAll(/"id"\s*:\s*"([^"]+)"/g)) dejaSignales.add(id);
        continue;
      }
      if (!donnees || typeof donnees !== "object" || Array.isArray(donnees)) {
        signaler(fichier, "fichier", `Le fichier doit etre un objet { ... } contenant : ${SECTIONS.join(", ")}.`);
        continue;
      }
      for (const cle of Object.keys(donnees)) {
        if (!SECTIONS.includes(cle)) signaler(fichier, cle, `Section inconnue (attendu : ${SECTIONS.join(", ")}).`);
      }

      for (const [section, schema] of Object.entries(LISTES)) {
        const liste = donnees[section];
        if (liste === undefined) continue;
        if (!Array.isArray(liste)) {
          signaler(fichier, section, "Doit etre une liste [ ... ].");
          continue;
        }
        liste.forEach((brut, index) => {
          const emplacement = `${section}[${index}]${brut?.id ? ` (${brut.id})` : ""}`;
          const resultat = schema.safeParse(brut);
          if (!resultat.success) {
            signaler(fichier, emplacement, messageZod(resultat.error));
            if (typeof brut?.id === "string") dejaSignales.add(brut.id);
          } else if (nouveau[section].has(resultat.data.id)) {
            signaler(fichier, emplacement, "Identifiant deja utilise par une autre entree : ignoree.");
          } else {
            nouveau[section].set(resultat.data.id, resultat.data);
            origine.set(`${section}:${resultat.data.id}`, fichier);
          }
        });
      }

      if (donnees.creation !== undefined) {
        const resultat = SchemaReglesCreation.safeParse(donnees.creation);
        if (!resultat.success) {
          signaler(fichier, "creation", `${messageZod(resultat.error)} (regles officielles de D&D 5e utilisees)`);
        } else if (fichierCreation) {
          signaler(fichier, "creation", `Deja definie dans ${relative(dossier, fichierCreation)} : ignoree.`);
        } else {
          nouveau.creation = resultat.data;
          fichierCreation = fichier;
        }
      }
    }

    // --- 2. Verification des liens entre sections ------------------------------
    // (une race qui cite une faction inexistante, une classe mal orthographiee...)
    const inconnus = (ids, section) => ids.filter((id) => !nouveau[section].has(id) && !dejaSignales.has(id));
    for (const race of nouveau.races.values()) {
      const fichier = origine.get(`races:${race.id}`);
      const inconnues = inconnus(race.factions, "factions");
      if (inconnues.length) signaler(fichier, `races (${race.id})`, `Faction inconnue : ${inconnues.join(", ")}.`);
      if (race.factions.some((id) => !nouveau.factions.has(id))) {
        race.factions = race.factions.filter((id) => nouveau.factions.has(id));
        if (!race.factions.length) {
          if (inconnues.length) signaler(fichier, `races (${race.id})`, "Aucune faction valide : race ignoree.");
          nouveau.races.delete(race.id);
          continue;
        }
      }
      // Les choix d'options limites a certaines factions : factions connues ?
      for (const option of race.options) {
        for (const choix of option.choix) {
          const absentes = inconnus(choix.factions ?? [], "factions");
          if (absentes.length) {
            signaler(fichier, `races (${race.id}) > ${option.id} > ${choix.id}`, `Faction inconnue : ${absentes.join(", ")} (ignoree).`);
          }
          if (choix.factions) choix.factions = choix.factions.filter((id) => nouveau.factions.has(id));
        }
      }
      if (Array.isArray(race.classesAutorisees)) {
        const absentes = inconnus(race.classesAutorisees, "classes");
        if (absentes.length) {
          signaler(fichier, `races (${race.id})`, `Classe inconnue dans classesAutorisees : ${absentes.join(", ")} (ignoree).`);
        }
        race.classesAutorisees = race.classesAutorisees.filter((id) => nouveau.classes.has(id));
        if (!race.classesAutorisees.length && absentes.length) {
          signaler(fichier, `races (${race.id})`, "Aucune classe autorisee valide : cette race ne peut pas etre choisie.");
        }
      }
    }
    for (const classe of nouveau.classes.values()) {
      const absentes = inconnus(
        classe.ressources.map((r) => r.ressource),
        "ressources",
      );
      if (absentes.length) {
        signaler(origine.get(`classes:${classe.id}`), `classes (${classe.id})`, `Ressource inconnue : ${absentes.join(", ")} (ignoree).`);
      }
      classe.ressources = classe.ressources.filter((r) => nouveau.ressources.has(r.ressource));
    }
    for (const classe of nouveau.classes.values()) {
      const peuples = classe.restrictionLore?.peuples ?? [];
      const absentes = inconnus(
        peuples.map((p) => p.race),
        "races",
      );
      if (absentes.length) {
        signaler(origine.get(`classes:${classe.id}`), `classes (${classe.id}) > restrictionLore`, `Race inconnue : ${absentes.join(", ")} (ignoree).`);
      }
      if (classe.restrictionLore) {
        classe.restrictionLore.peuples = peuples.filter((p) => nouveau.races.has(p.race));
        if (!classe.restrictionLore.peuples.length) delete classe.restrictionLore;
      }
    }
    for (const historique of nouveau.historiques.values()) {
      if (!nouveau.dons.has(historique.donOrigine) && !dejaSignales.has(historique.donOrigine)) {
        signaler(
          origine.get(`historiques:${historique.id}`),
          `historiques (${historique.id})`,
          `Don d'origine inconnu : ${historique.donOrigine} (ajoute-le dans la section "dons").`,
        );
      } else if (nouveau.dons.get(historique.donOrigine)?.categorie !== "origine" && nouveau.dons.has(historique.donOrigine)) {
        signaler(origine.get(`historiques:${historique.id}`), `historiques (${historique.id})`, `${historique.donOrigine} n'est pas un don d'origine.`);
      }
    }
    // Langues et renommee : tables de langues, langue du peuple, factions de
    // renommee citees par les peuples et les classes, paliers des avantages.
    for (const langue of nouveau.langues.values()) {
      const absentes = inconnus(langue.tables, "factions");
      if (absentes.length) signaler(origine.get(`langues:${langue.id}`), `langues (${langue.id})`, `Faction inconnue : ${absentes.join(", ")} (ignoree).`);
      langue.tables = langue.tables.filter((id) => nouveau.factions.has(id));
    }
    const paliers = new Set(nouveau.creation.paliersRenommee.map((p) => p.id));
    for (const faction of nouveau.renommees.values()) {
      const ou = `renommees (${faction.id})`;
      if (faction.faction && !nouveau.factions.has(faction.faction)) {
        signaler(origine.get(`renommees:${faction.id}`), ou, `Faction inconnue : ${faction.faction} (faction neutre).`);
        faction.faction = null;
      }
      const sansPalier = faction.avantages.filter((a) => !paliers.has(a.palier));
      if (sansPalier.length) {
        signaler(origine.get(`renommees:${faction.id}`), ou, `Palier inconnu : ${sansPalier.map((a) => a.palier).join(", ")} (ignore).`);
        faction.avantages = faction.avantages.filter((a) => paliers.has(a.palier));
      }
    }
    const verifierRenommee = (fichier, ou, porteur) => {
      if (!porteur?.renommee) return;
      if (!nouveau.renommees.has(porteur.renommee.faction)) {
        if (!dejaSignales.has(porteur.renommee.faction)) {
          signaler(fichier, ou, `Faction de renommee inconnue : ${porteur.renommee.faction} (ajoute-la dans la section "renommees").`);
        }
        porteur.renommee = null;
      }
    };
    for (const race of nouveau.races.values()) {
      const fichier = origine.get(`races:${race.id}`);
      verifierRenommee(fichier, `races (${race.id})`, race);
      for (const option of race.options) for (const choix of option.choix) verifierRenommee(fichier, `races (${race.id}) > ${option.id} > ${choix.id}`, choix);
      if (race.langue && !nouveau.langues.has(race.langue)) {
        if (!dejaSignales.has(race.langue)) signaler(fichier, `races (${race.id})`, `Langue inconnue : ${race.langue} (ignoree).`);
        delete race.langue;
      }
    }
    for (const classe of nouveau.classes.values()) {
      verifierRenommee(origine.get(`classes:${classe.id}`), `classes (${classe.id})`, classe);
      if (classe.renommee === null) delete classe.renommee;
    }

    for (const section of ["factions", "races", "classes"]) {
      if (!nouveau[section].size) signaler(null, section, "Aucune entree valide : la creation de personnage est impossible.");
    }

    // On ne remplace l'ancien contenu qu'une fois la lecture terminee.
    contenu = nouveau;
    return {
      factions: nouveau.factions.size,
      races: nouveau.races.size,
      classes: nouveau.classes.size,
      historiques: nouveau.historiques.size,
      dons: nouveau.dons.size,
      ressources: nouveau.ressources.size,
      langues: nouveau.langues.size,
      renommees: nouveau.renommees.size,
      creationPersonnalisee: fichierCreation !== null,
      erreurs,
    };
  }

  /** Classes qu'une race peut choisir (toutes, si les restrictions sont desactivees). */
  function classesPermises(race) {
    if (!contenu.creation.restrictionsRaceClasse || race.classesAutorisees === "toutes") {
      return [...contenu.classes.keys()];
    }
    return race.classesAutorisees;
  }

  return {
    charger,

    /** Tout le referentiel, pret a etre envoye aux navigateurs. */
    lister: () => ({
      factions: [...contenu.factions.values()].map((f) => ({ ...f, embleme: f.embleme ?? `faction-${f.id}` })),
      races: [...contenu.races.values()].map((r) => ({
        ...r,
        icone: r.icone ?? `race-${r.id}`,
        classesPermises: classesPermises(r),
      })),
      classes: [...contenu.classes.values()].map((c) => ({ ...c, icone: c.icone ?? `classe-${c.id}` })),
      historiques: [...contenu.historiques.values()],
      dons: [...contenu.dons.values()],
      ressources: [...contenu.ressources.values()],
      langues: [...contenu.langues.values()],
      renommees: [...contenu.renommees.values()],
      creation: contenu.creation,
    }),

    obtenirFaction: (id) => contenu.factions.get(id) ?? null,
    obtenirRace: (id) => contenu.races.get(id) ?? null,
    obtenirClasse: (id) => contenu.classes.get(id) ?? null,
    obtenirRessource: (id) => contenu.ressources.get(id) ?? null,
    obtenirHistorique: (id) => contenu.historiques.get(id) ?? null,
    obtenirDon: (id) => contenu.dons.get(id) ?? null,
    obtenirLangue: (id) => contenu.langues.get(id) ?? null,
    obtenirRenommee: (id) => contenu.renommees.get(id) ?? null,
    reglesCreation: () => contenu.creation,

    /** Cette race peut-elle prendre cette classe ? (les deux doivent exister) */
    combinaisonPermise(idRace, idClasse) {
      const race = contenu.races.get(idRace);
      return Boolean(race && contenu.classes.has(idClasse) && classesPermises(race).includes(idClasse));
    },
  };
}
