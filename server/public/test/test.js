// Banc de test. Volontairement brut : aucun style, aucun framework.
// Ce navigateur ne calcule RIEN : il envoie des demandes et affiche ce que le
// serveur renvoie. Si deux navigateurs affichent la meme chose, le temps reel
// et l'autorite du serveur fonctionnent.
import { EVENEMENTS, ROLES, TYPES_PV } from "/partage/protocole.js";
import { CARACTERISTIQUES } from "/partage/dnd5e.js";
import { ETATS_DE_BASE } from "/partage/etats.js";
import { RARETES } from "/partage/raretes.js";
import { caseDe } from "/partage/geometrie.js";
import { MoteurCarte } from "/partage/moteur-carte.js";

const $ = (id) => document.getElementById(id);
const CLE_JETON = "vtt-jeton";
const CLE_TABLE = "vtt-table";
const CLE_MOI = "vtt-moi";

let socket = null;
let moi = null;
let combat = null;
let compendium = { objets: [], sorts: [], etats: [] };
// Races, classes, ressources : lues dans les fichiers JSON du referentiel (serveur).
let referentiel = { factions: [], races: [], classes: [], ressources: [] };
const nomClasse = (id) => referentiel.classes.find((c) => c.id === id)?.nom ?? id;
const nomRace = (id) => (id ? (referentiel.races.find((r) => r.id === id)?.nom ?? id) : "");
let scene = null;
let moteur = null;
const personnages = new Map();
const saisies = new Map(); // valeurs tapees, conservees entre deux affichages

const estMJ = () => moi?.role === ROLES.MJ;
const monPersonnage = (p) => p?.proprietaire?.toLocaleLowerCase("fr") === moi?.pseudo?.toLocaleLowerCase("fr");

// --- Memoire de l'onglet (sessionStorage : propre a CET onglet) --------------------
const memoire = {
  lire(cle) {
    try {
      return sessionStorage.getItem(cle);
    } catch {
      return null;
    }
  },
  ecrire(cle, valeur) {
    try {
      if (valeur === null) sessionStorage.removeItem(cle);
      else sessionStorage.setItem(cle, valeur);
    } catch {
      /* navigation privee stricte : on s'en passe */
    }
  },
};

// --- Petits outils d'affichage ------------------------------------------------------
// Jamais d'innerHTML avec des textes venant des joueurs : un pseudo comme
// "<script>..." s'affiche tel quel au lieu de s'executer.
function el(balise, ...enfants) {
  const noeud = document.createElement(balise);
  for (const enfant of enfants) if (enfant !== null && enfant !== undefined) noeud.append(enfant);
  return noeud;
}

function bouton(texte, action) {
  const b = el("button", texte);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}

/** Champ dont la valeur survit aux rafraichissements de l'affichage. */
function champ(cle, type, defaut, taille = 4) {
  const input = el("input");
  input.type = type;
  input.size = taille;
  input.value = saisies.get(cle) ?? defaut;
  input.addEventListener("input", () => saisies.set(cle, input.value));
  return input;
}

function liste(cle, options, defaut) {
  const select = el("select");
  for (const [valeur, texte] of options) {
    const option = el("option", texte);
    option.value = valeur;
    select.append(option);
  }
  select.value = saisies.get(cle) ?? defaut ?? options[0]?.[0] ?? "";
  select.addEventListener("change", () => saisies.set(cle, select.value));
  return select;
}

// Petite image d'icone : le serveur renvoie un carre gris si le fichier manque.
function icone(nom, taille = 20) {
  const img = el("img");
  img.src = `/medias/icones/${encodeURIComponent(nom)}`;
  img.width = taille;
  img.height = taille;
  img.alt = "";
  return img;
}

const signe = (n) => (n >= 0 ? `+${n}` : `${n}`);
const nomRarete = (cle) => `${RARETES[cle]?.nom ?? cle} - ${RARETES[cle]?.teinte ?? "?"}`;
const regleRepos = (r) => (typeof r === "object" ? `+${r.ajouter}` : r);

function journal(texte) {
  $("journal").prepend(el("li", `[${new Date().toLocaleTimeString("fr-FR")}] ${texte}`));
}

function afficherZone(zone) {
  $("zone-connexion").hidden = zone !== "connexion";
  $("zone-tables").hidden = zone === "connexion";
  $("zone-jeu").hidden = zone !== "jeu";
}

function afficherElementsMJ() {
  for (const noeud of document.querySelectorAll("[data-mj-seulement]")) noeud.hidden = !estMJ();
}

// --- Fiches de personnage ---------------------------------------------------------------

function blocRessources(p) {
  const bloc = el("div", el("b", "Ressources : "));
  if (p.ressources.length === 0) bloc.append("aucune");
  const ul = el("ul");
  for (const r of p.ressources) {
    const modifier = (variation) => () =>
      demander(EVENEMENTS.RESSOURCE_MODIFIER, { idPersonnage: p.id, cle: r.cle, variation });
    ul.append(
      el(
        "li",
        `${r.nom} ${r.actuel}/${r.max} (${r.type}, repos court : ${regleRepos(r.reposCourt)}, ` +
          `repos long : ${regleRepos(r.reposLong)}) `,
        bouton("-1", modifier(-1)),
        bouton("+1", modifier(1)),
        r.max >= 20 ? bouton("-10", modifier(-10)) : null,
        r.max >= 20 ? bouton("+10", modifier(10)) : null,
        estMJ()
          ? bouton("Retirer", () => demander(EVENEMENTS.RESSOURCE_RETIRER, { idPersonnage: p.id, cle: r.cle }))
          : null,
      ),
    );
  }
  bloc.append(ul);

  if (estMJ()) {
    const modele = liste(
      `${p.id}:modele`,
      referentiel.ressources.map((m) => [m.id, `${m.nom} (${m.type})`]),
    );
    const max = champ(`${p.id}:max`, "number", "");
    max.placeholder = "max";
    bloc.append(
      "Ajouter une jauge WoW : ",
      modele,
      " max ",
      max,
      " ",
      bouton("Ajouter", () =>
        demander(EVENEMENTS.RESSOURCE_AJOUTER, {
          idPersonnage: p.id,
          modele: modele.value,
          ...(max.value ? { max: Number(max.value) } : {}),
        }),
      ),
    );
  }
  return bloc;
}

function blocRepos(p) {
  const des = champ(`${p.id}:des`, "number", "1", 3);
  return el(
    "p",
    el("b", "Repos : "),
    `Des de vie a depenser `,
    des,
    " ",
    bouton("Repos court", () =>
      demander(EVENEMENTS.REPOS_COURT, { idPersonnage: p.id, desDeVie: Number(des.value) }),
    ),
    estMJ() ? " " : null,
    estMJ() ? bouton("Faire un repos long", () => demander(EVENEMENTS.REPOS_LONG, { idPersonnage: p.id })) : null,
  );
}

function blocEtats(p) {
  const bloc = el("div", el("b", "Etats : "));
  if (p.etats.length === 0) bloc.append("aucun");
  const ul = el("ul");
  for (const e of p.etats) {
    ul.append(
      el(
        "li",
        icone(e.icone),
        ` ${e.nom} [${e.nature}] ${e.roundsRestants ? `- ${e.roundsRestants} round(s)` : "- sans limite"} ` +
          `(icone : "${e.icone}", pose par ${e.posePar}) `,
        bouton("Retirer", () => demander(EVENEMENTS.ETAT_RETIRER, { idPersonnage: p.id, idEtat: e.id })),
      ),
    );
  }
  bloc.append(ul);

  // Le MJ voit aussi les auras de son compendium ; les joueurs, les etats officiels.
  const definitions = estMJ() && compendium.etats.length
    ? compendium.etats
    : Object.entries(ETATS_DE_BASE).map(([cle, d]) => ({ cle, ...d }));
  const choix = liste(
    `${p.id}:etat`,
    definitions.map((d) => [d.cle, `${d.nom} (${d.nature}${d.dureeParDefaut ? `, ${d.dureeParDefaut} rounds` : ""})`]),
  );
  const rounds = champ(`${p.id}:rounds`, "number", "", 3);
  rounds.placeholder = "rounds";
  bloc.append(
    "Poser : ",
    choix,
    " duree ",
    rounds,
    " ",
    bouton("Poser", () =>
      demander(EVENEMENTS.ETAT_POSER, {
        idPersonnage: p.id,
        cle: choix.value,
        ...(rounds.value ? { rounds: Number(rounds.value) } : {}),
      }),
    ),
    " (duree vide = duree par defaut de l'etat, ou sans limite)",
  );
  return bloc;
}

function blocInventaire(p) {
  const bloc = el("div", el("b", `Inventaire (${p.inventaire.length}) : `));
  if (p.inventaire.length === 0) bloc.append("sac vide");
  const ul = el("ul");
  for (const o of p.inventaire) {
    const details = [
      o.type,
      o.arme ? `${o.arme.degats} ${o.arme.typeDegats}` : null,
      o.armure ? `CA +${o.armure.classeArmure}` : null,
      o.soins ? `soigne ${o.soins}` : null,
    ].filter(Boolean);
    ul.append(
      el(
        "li",
        icone(o.icone ?? o.source ?? "objet"),
        ` ${o.nom} x${o.quantite} [${nomRarete(o.rarete)}] (${details.join(", ")}) `,
        bouton("Jeter 1", () => demander(EVENEMENTS.INVENTAIRE_RETIRER, { idPersonnage: p.id, idObjet: o.id, quantite: 1 })),
      ),
    );
  }
  bloc.append(ul);
  return bloc;
}

function blocGrimoire(p) {
  const bloc = el("div", el("b", `Grimoire (${p.grimoire.length}) : `));
  if (p.grimoire.length === 0) bloc.append("aucun sort");
  const ul = el("ul");
  for (const s of p.grimoire) {
    const effet = s.degats ? `${s.degats.formule} ${s.degats.type}` : s.soins ? `soigne ${s.soins}` : "";
    ul.append(
      el(
        "li",
        icone(s.icone ?? s.source ?? "sort"),
        ` ${s.nom} (niv. ${s.niveau}, ${s.ecole}${effet ? `, ${effet}` : ""}` +
          `${s.cout ? `, cout ${s.cout.quantite} ${s.cout.ressource}` : ""}) `,
        bouton("Oublier", () => demander(EVENEMENTS.GRIMOIRE_OUBLIER, { idPersonnage: p.id, idSort: s.id })),
      ),
    );
  }
  bloc.append(ul);
  return bloc;
}

function afficherPersonnages() {
  const conteneur = $("liste-personnages");
  conteneur.replaceChildren();
  if (personnages.size === 0) conteneur.append(el("p", "(aucun personnage)"));

  for (const p of personnages.values()) {
    const pv = p.pointsDeVie;
    const montant = champ(`${p.id}:montant`, "number", "5");
    const critique = Object.assign(el("input"), { type: "checkbox" });
    const modifierPv = (type) => () =>
      demander(EVENEMENTS.PERSONNAGE_MODIFIER_PV, {
        idPersonnage: p.id,
        type,
        montant: Number(montant.value),
        critique: type === TYPES_PV.DEGATS && critique.checked,
      });

    const resume = el(
      "summary",
      el("strong", p.nom),
      ` - ${nomRace(p.race)} ${nomClasse(p.classe)} niv. ${p.niveau} - ${p.proprietaire ?? "PNJ (cache)"} - ` +
        `PV ${pv.actuels}/${pv.max}${pv.temporaires ? ` (+${pv.temporaires} temp.)` : ""}` +
        (p.etats.length ? ` - etats : ${p.etats.map((e) => e.nom).join(", ")}` : ""),
    );

    const fiche = el(
      "details",
      resume,
      el(
        "p",
        `CA ${p.classeArmure} - Maitrise ${signe(p.derives.bonusDeMaitrise)} - Initiative ${signe(p.derives.bonusInitiative)} - ` +
          `Des de vie ${p.desDeVie.restants}/${p.niveau} (d${p.desDeVie.faces})`,
        el("br"),
        CARACTERISTIQUES.map(
          (c) => `${c.slice(0, 3).toUpperCase()} ${p.caracteristiques[c]} (${signe(p.derives.modificateurs[c])})`,
        ).join(", "),
      ),
      el(
        "p",
        el("b", "Points de vie : "),
        montant,
        " ",
        bouton("Degats", modifierPv(TYPES_PV.DEGATS)),
        el("label", critique, "critique "),
        bouton("Soins", modifierPv(TYPES_PV.SOINS)),
        bouton("PV temporaires", modifierPv(TYPES_PV.TEMPORAIRES)),
      ),
      blocRepos(p),
      blocRessources(p),
      blocEtats(p),
      blocInventaire(p),
      blocGrimoire(p),
      el(
        "p",
        bouton("Supprimer le personnage", () => {
          if (confirm(`Supprimer ${p.nom} ? (la fiche part dans la corbeille)`)) {
            demander(EVENEMENTS.PERSONNAGE_SUPPRIMER, { idPersonnage: p.id });
          }
        }),
      ),
    );
    fiche.open = saisies.get(`${p.id}:ouvert`) !== "non";
    fiche.addEventListener("toggle", () => saisies.set(`${p.id}:ouvert`, fiche.open ? "oui" : "non"));
    conteneur.append(fiche, el("hr"));
  }
  afficherListesDePersonnages();
  afficherOutilsScene();
}

// Menus deroulants qui listent les personnages (destinataire du compendium, ajout au combat).
function afficherListesDePersonnages() {
  const options = [...personnages.values()].map((p) => [p.id, `${p.nom} (${p.proprietaire ?? "PNJ"})`]);
  const destinataire = $("choix-destinataire");
  const precedent = destinataire.value;
  // Les coffres et cadavres de la carte peuvent aussi recevoir des objets du compendium.
  const butins = (scene?.butins ?? []).map((b) => [b.id, `Butin : ${b.nom}`]);
  destinataire.replaceChildren(...[...options, ...butins].map(([v, t]) => Object.assign(el("option", t), { value: v })));
  if (precedent) destinataire.value = precedent;

  const horsCombat = options.filter(([id]) => !combat?.participants.some((c) => c.idPersonnage === id));
  $("choix-ajout-combat").replaceChildren(...horsCombat.map(([v, t]) => Object.assign(el("option", t), { value: v })));
}

// --- Combat -------------------------------------------------------------------------------

// --- Journal de quetes : le MJ en donne, ajoutees en direct chez tous les joueurs ---------
const STATUTS_QUETE = { "en-cours": "en cours", terminee: "terminee", echouee: "echouee" };
function afficherQuetes(quetes) {
  const ul = $("liste-quetes");
  ul.replaceChildren();
  if (!quetes.length) ul.append(el("li", "Aucune quete."));
  for (const q of quetes) {
    const actions = estMJ()
      ? [
          " ",
          q.statut !== "terminee" ? bouton("Terminer", () => demander(EVENEMENTS.QUETE_MODIFIER, { idQuete: q.id, statut: "terminee" })) : "",
          q.statut !== "echouee" ? bouton("Echec", () => demander(EVENEMENTS.QUETE_MODIFIER, { idQuete: q.id, statut: "echouee" })) : "",
          q.statut !== "en-cours" ? bouton("Rouvrir", () => demander(EVENEMENTS.QUETE_MODIFIER, { idQuete: q.id, statut: "en-cours" })) : "",
          bouton("Retirer", () => confirm(`Retirer la quete "${q.titre}" ?`) && demander(EVENEMENTS.QUETE_SUPPRIMER, { idQuete: q.id })),
        ]
      : [];
    ul.append(el("li", el("strong", q.titre), ` (${STATUTS_QUETE[q.statut]}) : ${q.objectif}`, ...actions));
  }
}

function afficherCombat() {
  const ol = $("liste-combat");
  ol.replaceChildren();
  if (!combat) {
    $("combat-statut").textContent = "Pas de combat en cours.";
    afficherListesDePersonnages();
    return;
  }
  const actif = combat.participants[combat.indexActif];
  $("combat-statut").textContent = `Round ${combat.round} - c'est au tour de : ${actif.nom}`;

  combat.participants.forEach((c, index) => {
    const ligne = el(
      "li",
      index === combat.indexActif ? ">>> " : "",
      `${c.nom} : initiative ${c.initiative} (d20 ${c.jet} ${signe(c.bonus)}) `,
    );
    if (estMJ()) {
      const valeur = champ(`${c.id}:init`, "number", String(c.initiative), 3);
      ligne.append(
        valeur,
        bouton("Fixer", () =>
          demander(EVENEMENTS.COMBAT_FIXER_INITIATIVE, { idParticipant: c.id, valeur: Number(valeur.value) }),
        ),
        bouton("Retirer", () => demander(EVENEMENTS.COMBAT_RETIRER, { idParticipant: c.id })),
      );
    }
    ol.append(ligne);
  });
  afficherListesDePersonnages();
}

// --- Compendium et cartes (MJ) ---------------------------------------------------------------

async function chargerCompendium() {
  if (!estMJ()) return;
  const reponse = await demander(EVENEMENTS.COMPENDIUM_LISTER, {});
  if (!reponse.ok) return;
  compendium = reponse;
  const destinataire = () => $("choix-destinataire").value;

  $("liste-objets").replaceChildren(
    ...compendium.objets.map((o) => {
      const quantite = champ(`compendium:${o.id}`, "number", "1", 3);
      return el(
        "li",
        icone(o.icone ?? o.id),
        ` ${o.nom} [${nomRarete(o.rarete)}] - ${o.type} `,
        quantite,
        " ",
        bouton(`Ajouter "${o.nom}"`, () =>
          destinataire().startsWith("b-")
            ? demander(EVENEMENTS.BUTIN_AJOUTER, { idButin: destinataire(), idObjet: o.id, quantite: Number(quantite.value) })
            : demander(EVENEMENTS.INVENTAIRE_AJOUTER, {
                idPersonnage: destinataire(),
                idObjet: o.id,
                quantite: Number(quantite.value),
              }),
        ),
      );
    }),
  );
  $("liste-sorts").replaceChildren(
    ...compendium.sorts.map((s) =>
      el(
        "li",
        icone(s.icone ?? s.id),
        ` ${s.nom} (niv. ${s.niveau}, ${s.ecole}${s.cout ? `, ${s.cout.quantite} ${s.cout.ressource}` : ""}) `,
        bouton("Apprendre", () => demander(EVENEMENTS.GRIMOIRE_APPRENDRE, { idPersonnage: destinataire(), idSort: s.id })),
      ),
    ),
  );
  $("liste-auras").replaceChildren(
    ...compendium.etats
      .filter((e) => !e.officiel)
      .map((e) => el("li", icone(e.icone), ` ${e.nom} [${e.nature}] - icone "${e.icone}" - ${e.description}`)),
  );
  afficherPersonnages();
}

function afficherErreursCompendium(rapport) {
  $("erreurs-compendium").replaceChildren(
    ...rapport.erreurs.map((e) => el("li", `ERREUR compendium/${e.fichier} > ${e.emplacement} : ${e.message}`)),
  );
}

async function chargerListeCartes() {
  const reponse = await demander(EVENEMENTS.MEDIAS_LISTER, { categorie: "cartes" });
  if (!reponse.ok) return;
  const options = [["", "(carte de test : carre gris de 2000 px)"], ...reponse.fichiers.map((f) => [f, f])];
  $("choix-carte").replaceChildren(...options.map(([v, t]) => Object.assign(el("option", t), { value: v })));
  $("choix-carte").value = scene?.carte.fichier ?? "";
}

// --- Carte : branchement du moteur sur le temps reel ------------------------------------------

function creerMoteur() {
  moteur = new MoteurCarte($("carte"), {
    get estMJ() {
      return estMJ();
    },
    // Simple confort d'affichage : le SERVEUR verifie de toute facon.
    peutDeplacer: (pion) => estMJ() || pion.proprietaire?.toLocaleLowerCase("fr") === moi?.pseudo.toLocaleLowerCase("fr"),
    // 1. SAISIR : le serveur accorde-t-il le pion (droit + verrou) ?
    surSaisie: async (pion) => (await demander(EVENEMENTS.PION_SAISIR, { idPion: pion.id })).ok,
    // 2. GLISSER (final: false) et 3. LACHER (final: true).
    surDeplacement: async (pion, x, y, final, aimanter) => {
      if (!final) {
        socket?.emit(EVENEMENTS.PION_DEPLACER, { idPion: pion.id, x, y, final: false, aimanter });
        return null;
      }
      const reponse = await demander(EVENEMENTS.PION_DEPLACER, { idPion: pion.id, x, y, final: true, aimanter });
      return reponse.ok ? reponse.position : null;
    },
    surTrait: (trait) =>
      socket?.emit(EVENEMENTS.BROUILLARD_TRAIT, trait, (reponse) => {
        if (!reponse?.ok) journal(`REFUS du serveur : ${reponse?.erreur}`);
      }),
    surInfo: (texte) => ($("info-carte").textContent = texte),
  });
}

function recevoirScene(nouvelle) {
  scene = nouvelle;
  if (!moteur) creerMoteur();
  moteur.chargerScene(nouvelle);
  afficherOutilsScene();
}

const descriptionCase = (pion) => {
  const { colonne, ligne } = caseDe(pion.x, pion.y, scene.grille);
  return `case (${colonne}, ${ligne})`;
};

function afficherOutilsScene() {
  if (!scene) return;
  // Joueur : ou est mon pion ?
  const miens = scene.pions.filter((p) => p.proprietaire?.toLocaleLowerCase("fr") === moi?.pseudo.toLocaleLowerCase("fr"));
  $("mes-pions").textContent = estMJ()
    ? ""
    : miens.length
      ? `Tes pions : ${miens.map((p) => `${p.nom} ${descriptionCase(p)}`).join(", ")}. Clique dessus et fais-les glisser.`
      : "Aucun de tes personnages n'est sur la carte : le MJ doit placer ton pion.";
  if (!estMJ()) return;

  // MJ : reglages de la grille
  const g = scene.grille;
  for (const [curseur, nombre, cle] of [
    ["grille-taille", "grille-taille-n", "taille"],
    ["grille-x", "grille-x-n", "decalageX"],
    ["grille-y", "grille-y-n", "decalageY"],
  ]) {
    if (document.activeElement !== $(curseur)) $(curseur).value = g[cle];
    if (document.activeElement !== $(nombre)) $(nombre).value = g[cle];
  }
  $("grille-visible").checked = g.visible;
  $("brouillard-actif").checked = scene.brouillard.actif;
  if ($("choix-carte").options.length) $("choix-carte").value = scene.carte.fichier ?? "";

  // MJ : liste des pions
  $("liste-pions").replaceChildren(
    ...scene.pions.map((p) =>
      el(
        "li",
        `${p.nom} (${p.proprietaire ?? "PNJ"}) - ${descriptionCase(p)}${p.cache ? " - CACHE aux joueurs" : ""} `,
        bouton(p.cache ? "Montrer aux joueurs" : "Cacher aux joueurs", () =>
          demander(EVENEMENTS.PION_CACHER, { idPion: p.id, cache: !p.cache }),
        ),
        bouton("Retirer de la carte", () => demander(EVENEMENTS.PION_RETIRER, { idPion: p.id })),
        p.proprietaire === null
          ? bouton("Tue : laisser un cadavre a fouiller", () => demander(EVENEMENTS.PION_EN_CADAVRE, { idPion: p.id }))
          : null,
      ),
    ),
  );
  $("liste-butins").replaceChildren(
    ...(scene.butins ?? []).map((b) =>
      el(
        "li",
        `${b.genre === "cadavre" ? "Cadavre" : "Coffre"} "${b.nom}" - ${descriptionCase(b)} - ${b.objets.length ? b.objets.map((o) => `${o.nom}${o.quantite > 1 ? ` x${o.quantite}` : ""}`).join(", ") : "vide"} `,
        bouton("Supprimer", () => demander(EVENEMENTS.BUTIN_SUPPRIMER, { idButin: b.id })),
      ),
    ),
  );
  afficherListesDePersonnages();
  const absents = [...personnages.values()].filter((p) => !scene.pions.some((j) => j.idPersonnage === p.id));
  $("choix-pion").replaceChildren(
    ...absents.map((p) => Object.assign(el("option", `${p.nom} (${p.proprietaire ?? "PNJ"})`), { value: p.id })),
  );
}

// Reglage de la grille : affichage immediat chez le MJ, envoi au serveur
// au plus toutes les 100 ms (inutile d'envoyer chaque pixel du curseur).
let minuterieGrille = null;
function reglerGrille(modification) {
  if (!scene) return;
  const grille = { ...scene.grille, ...modification };
  grille.taille = Math.min(1000, Math.max(10, Math.round(grille.taille * 10) / 10));
  grille.decalageX = Math.round(grille.decalageX * 10) / 10;
  grille.decalageY = Math.round(grille.decalageY * 10) / 10;
  scene = { ...scene, grille };
  moteur.majGrille(grille);
  afficherOutilsScene();
  clearTimeout(minuterieGrille);
  minuterieGrille = setTimeout(() => demander(EVENEMENTS.SCENE_GRILLE, grille), 100);
}

function decrireScene(cause) {
  switch (cause.action) {
    case "carte":
      return `${cause.par} affiche la carte ${cause.fichier ?? "de test"} (brouillard remis a zero).`;
    case "pion-place":
      return `${cause.par} place le pion de ${cause.nom}.`;
    case "pions-places":
      return `${cause.par} place ${cause.nombre} pion(s).`;
    case "pion-retire":
      return `${cause.par} retire un pion de la carte.`;
    case "pion-cache":
      return `${cause.par} cache un pion aux joueurs.`;
    case "pion-montre":
      return `${cause.par} montre un pion aux joueurs.`;
    case "tout-revele":
      return `${cause.par} revele toute la carte.`;
    case "tout-cache":
      return `${cause.par} recouvre toute la carte de brouillard.`;
    case "brouillard-active":
      return `${cause.par} active le brouillard.`;
    case "brouillard-desactive":
      return `${cause.par} desactive le brouillard.`;
    case "visibilite":
      return "Un pion apparait ou disparait dans le brouillard.";
    default:
      return `Scene mise a jour (${cause.action}).`;
  }
}

// --- Communication avec le serveur -------------------------------------------------------------

/** Envoie une demande et attend la reponse (l'"accuse de reception"). */
function demander(evenement, donnees) {
  return new Promise((resoudre) => {
    if (!socket?.connected) {
      journal("ERREUR : pas de liaison avec le serveur.");
      return resoudre({ ok: false });
    }
    socket.timeout(5000).emit(evenement, donnees, (delaiDepasse, reponse) => {
      if (delaiDepasse) {
        journal(`ERREUR : le serveur n'a pas repondu a "${evenement}".`);
        return resoudre({ ok: false });
      }
      if (!reponse.ok) journal(`REFUS du serveur : ${reponse.erreur}`);
      resoudre(reponse);
    });
  });
}

async function listerTables() {
  const reponse = await demander(EVENEMENTS.TABLES_LISTER, {});
  if (reponse.ok) remplirTables(reponse.tables);
}

function remplirTables(tables) {
  const choix = $("liste-tables");
  const precedent = choix.value;
  choix.replaceChildren(...tables.map((t) => Object.assign(el("option", t.nom), { value: t.id })));
  if (tables.length === 0) {
    choix.append(Object.assign(el("option", "(aucune table : le MJ doit en creer une)"), { value: "" }));
  }
  // On ne reselectionne l'ancienne table que si elle existe encore.
  if (tables.some((t) => t.id === precedent)) choix.value = precedent;
}

async function rejoindre(idTable) {
  const reponse = await demander(EVENEMENTS.TABLE_REJOINDRE, { idTable });
  if (!reponse.ok) {
    memoire.ecrire(CLE_TABLE, null);
    return;
  }
  if (reponse.creationRequise) {
    // Un joueur sans personnage : le serveur le laisse a la porte de la table.
    journal(`Tu n'as pas encore de personnage a "${reponse.table.nom}" : cree-le depuis l'interface de jeu (adresse /).`);
    return;
  }
  memoire.ecrire(CLE_TABLE, idTable);
  $("nom-table").textContent = reponse.table.nom;
  personnages.clear();
  for (const p of reponse.personnages) personnages.set(p.id, p);
  combat = reponse.combat;
  afficherQuetes(reponse.quetes ?? []);
  afficherZone("jeu");
  recevoirScene(reponse.scene);
  afficherPersonnages();
  afficherCombat();
  journal(`Table "${reponse.table.nom}" rejointe (${reponse.personnages.length} personnage(s) visible(s)).`);
  if (estMJ()) {
    await chargerCompendium();
    await chargerListeCartes();
  }
}

// Traduit la "cause" d'une mise a jour de fiche en phrase lisible.
function decrireCause(p, cause) {
  const pv = p.pointsDeVie;
  const ressources = (liste) => liste.map((r) => `${r.nom} ${r.avant}->${r.apres}`).join(", ");
  switch (cause.action) {
    case "creation":
      return `${cause.par} a cree ${p.nom}.`;
    case "points-de-vie": {
      const absorbes = cause.absorbesParTemporaires ? ` (${cause.absorbesParTemporaires} absorbes)` : "";
      return `${cause.par} : ${cause.type} ${cause.montant} sur ${p.nom}${absorbes} -> PV ${pv.actuels}/${pv.max}${cause.aTerre ? " - A TERRE !" : ""}`;
    }
    case "repos":
      if (cause.repos === "court") {
        const jets = cause.jets.map((j) => `${j.de}${signe(cause.modificateurConstitution)}`).join(", ");
        return (
          `${p.nom} : REPOS COURT, ${cause.desDepenses} de(s) de vie${jets ? ` [${jets}]` : ""} -> +${cause.pvRecuperes} PV ` +
          `(${pv.actuels}/${pv.max})${cause.ressources.length ? ` ; ${ressources(cause.ressources)}` : ""}`
        );
      }
      return (
        `${p.nom} : REPOS LONG -> +${cause.pvRecuperes} PV, ${cause.pvTemporairesPerdus} PV temp. perdus, ` +
        `+${cause.desDeVieRecuperes} de(s) de vie${cause.ressources.length ? ` ; ${ressources(cause.ressources)}` : ""}`
      );
    case "ressource":
      return `${cause.par} : ${cause.nom} de ${p.nom} ${cause.avant} -> ${cause.apres}`;
    case "ressource-ajoutee":
      return `${cause.par} ajoute la ressource ${cause.nom} a ${p.nom}.`;
    case "ressource-retiree":
      return `${cause.par} retire la ressource ${cause.nom} de ${p.nom}.`;
    case "etat-pose":
      return (
        `${cause.par} ${cause.rafraichi ? "rafraichit" : "pose"} ${cause.etat.nom} [${cause.etat.nature}, icone "${cause.etat.icone}"] ` +
        `sur ${p.nom}${cause.etat.roundsRestants ? ` pour ${cause.etat.roundsRestants} round(s)` : ""}.`
      );
    case "etat-retire":
      return `${cause.par} retire ${cause.etat.nom} de ${p.nom}.`;
    case "etats-ecoules":
      return cause.expires.length
        ? `Fin du tour de ${p.nom} : ${cause.expires.map((e) => e.nom).join(", ")} expire(nt).`
        : `Fin du tour de ${p.nom} : les durees des etats diminuent.`;
    case "objet-recu":
      return `${p.nom} recoit ${cause.quantite}x ${cause.nom} [${nomRarete(cause.rarete)}].`;
    case "objet-retire":
      return `${p.nom} se debarrasse de ${cause.quantite}x ${cause.nom}.`;
    case "sort-appris":
      return `${p.nom} apprend ${cause.nom}.`;
    case "sort-oublie":
      return `${p.nom} oublie ${cause.nom}.`;
    default:
      return `${p.nom} mis a jour (${cause.action}).`;
  }
}

function decrireCombat(cause) {
  const jets = (liste) => liste.map((j) => `${j.nom} ${j.initiative} (d20 ${j.jet} ${signe(j.bonus)})`).join(", ");
  switch (cause.action) {
    case "debut":
      return `COMBAT ! Initiative : ${jets(cause.jets)}`;
    case "tour":
      return `${cause.nouveauRound ? `--- Round ${cause.round} --- ` : ""}Fin du tour de ${cause.finDeTour}, au tour de ${cause.actif}.`;
    case "retour":
      return `${cause.par} revient au tour de ${cause.actif} (round ${cause.round}).`;
    case "arrivee":
      return `Arrivee en combat : ${jets(cause.jets)}`;
    case "retrait":
      return `${cause.nom} quitte le combat.`;
    case "initiative-fixee":
      return `${cause.par} fixe l'initiative de ${cause.nom} a ${cause.valeur}.`;
    case "fin":
      return `Fin du combat (${cause.rounds} round(s)).`;
    default:
      return `Combat mis a jour (${cause.action}).`;
  }
}

function brancherSocket(jeton) {
  // io() se connecte au serveur qui a servi cette page (en direct ou via le tunnel).
  socket = io({ auth: { jeton } });

  socket.on("connect", async () => {
    $("statut").textContent = "connecte";
    journal("Liaison temps reel etablie.");
    await listerTables();
    await chargerReferentiel();
    const table = memoire.lire(CLE_TABLE);
    if (table) await rejoindre(table); // retour automatique apres une coupure
  });

  socket.on("disconnect", (raison) => {
    $("statut").textContent = "deconnecte - reconnexion automatique en cours...";
    journal(`Liaison perdue (${raison}).`);
  });

  socket.on("connect_error", (erreur) => {
    if (erreur.message === "non-authentifie") {
      journal("Session expiree : reconnecte-toi.");
      deconnecter();
    } else {
      $("statut").textContent = "serveur injoignable - nouvel essai...";
    }
  });

  // --- Les FAITS diffuses par le serveur ---
  socket.on(EVENEMENTS.TABLES_LISTE, ({ tables }) => remplirTables(tables));

  socket.on(EVENEMENTS.TABLE_PRESENCE, ({ connectes }) => {
    $("liste-presence").textContent = connectes.map((c) => `${c.pseudo}${c.role === ROLES.MJ ? " (MJ)" : ""}`).join(", ");
  });

  socket.on(EVENEMENTS.PERSONNAGE_MAJ, ({ personnage, cause }) => {
    personnages.set(personnage.id, personnage);
    afficherPersonnages();
    journal(decrireCause(personnage, cause));
  });

  socket.on(EVENEMENTS.PERSONNAGE_SUPPRIME, ({ idPersonnage, par }) => {
    const nom = personnages.get(idPersonnage)?.nom ?? "un personnage";
    personnages.delete(idPersonnage);
    afficherPersonnages();
    journal(`${par} a supprime ${nom}.`);
  });

  socket.on(EVENEMENTS.REFERENTIEL_MAJ, ({ referentiel: nouveau }) => {
    referentiel = nouveau;
    remplirListesReferentiel();
    afficherPersonnages();
  });

  socket.on(EVENEMENTS.CHAT_MESSAGE, (m) => {
    if (m.canal === "murmure") journal(`[Murmure] ${m.de} -> ${m.vers} : ${m.texte}`);
    else journal(`[${m.canal === "groupe" ? "Groupe" : "Dire"}] ${m.nom} : ${m.texte}`);
  });
  socket.on(EVENEMENTS.SON_JOUER, ({ son }) => journal(`(Son joue chez les joueurs : ${son})`));
  socket.on(EVENEMENTS.QUETES_ETAT, ({ quetes, cause }) => {
    afficherQuetes(quetes);
    if (cause) journal(`Quete ${cause.action} : "${cause.titre}" (par ${cause.par}).`);
  });
  socket.on(EVENEMENTS.JET_RESULTAT, ({ jet }) => {
    const lignes = jet.lignes.map((l) => `${l.libelle} ${l.total}${l.critique ? " (critique)" : ""}`).join(", ");
    journal(`${jet.personnage} - ${jet.action.nom} : ${lignes || "lance"}.${jet.note ? ` ${jet.note}` : ""}`);
  });

  socket.on(EVENEMENTS.COMBAT_ETAT, ({ combat: nouveau, cause }) => {
    combat = nouveau;
    afficherCombat();
    journal(decrireCombat(cause));
  });

  // --- La carte ---
  socket.on(EVENEMENTS.SCENE_ETAT, ({ scene: nouvelle, cause }) => {
    recevoirScene(nouvelle);
    journal(decrireScene(cause));
  });
  socket.on(EVENEMENTS.SCENE_GRILLE_MAJ, ({ grille }) => {
    if (!scene) return;
    scene = { ...scene, grille };
    moteur.majGrille(grille);
    afficherOutilsScene();
  });
  socket.on(EVENEMENTS.PION_POSITION, ({ idPion, x, y, final }) => {
    moteur?.positionPion(idPion, x, y);
    const pion = scene?.pions.find((p) => p.id === idPion);
    if (pion && final) {
      Object.assign(pion, { x, y });
      afficherOutilsScene();
    }
  });
  socket.on(EVENEMENTS.BROUILLARD_TRAIT_AJOUTE, ({ trait }) => moteur?.ajouterTrait(trait));

  socket.on(EVENEMENTS.COMPENDIUM_MAJ, async ({ rapport }) => {
    journal(`Compendium recharge : ${rapport.objets} objets, ${rapport.sorts} sorts, ${rapport.etats} auras, ${rapport.erreurs.length} erreur(s).`);
    afficherErreursCompendium(rapport);
    await chargerCompendium();
  });

  socket.on(EVENEMENTS.DES_RESULTAT, (r) => {
    const detail = r.termes
      .map((t) =>
        t.type === "des"
          ? `${t.expression}[${t.jets.map((j, i) => (t.gardes.includes(i) ? j : `~${j}~`)).join(",")}]`
          : t.expression,
      )
      .join(" ");
    journal(`${r.secret ? "(SECRET) " : ""}${r.par} lance ${r.formule}${r.raison ? ` (${r.raison})` : ""} : ${detail} = ${r.total}`);
  });
}

function deconnecter() {
  socket?.disconnect();
  socket = null;
  moi = null;
  combat = null;
  for (const cle of [CLE_JETON, CLE_TABLE, CLE_MOI]) memoire.ecrire(cle, null);
  $("statut").textContent = "deconnecte";
  personnages.clear();
  afficherZone("connexion");
}

function demarrerSession(jeton, profil) {
  moi = profil;
  memoire.ecrire(CLE_JETON, jeton);
  memoire.ecrire(CLE_MOI, JSON.stringify(profil));
  $("moi").textContent = `${profil.pseudo} (${estMJ() ? "Maitre du Jeu" : "Joueur"})`;
  afficherElementsMJ();
  afficherZone("tables");
  brancherSocket(jeton);
}

// --- Boutons et formulaires fixes ------------------------------------------------------------

$("form-connexion").addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const champs = new FormData(evenement.target);
  try {
    const reponse = await fetch("/api/connexion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: champs.get("role"), pseudo: champs.get("pseudo"), motDePasse: champs.get("motDePasse") }),
    });
    const donnees = await reponse.json();
    if (!reponse.ok) return journal(`Connexion refusee : ${donnees.erreur}`);
    evenement.target.reset();
    journal(`Bienvenue, ${donnees.profil.pseudo}.`);
    demarrerSession(donnees.jeton, donnees.profil);
  } catch {
    journal("Connexion impossible : le serveur est-il lance ?");
  }
});

$("bouton-deconnexion").addEventListener("click", deconnecter);
$("bouton-rejoindre").addEventListener("click", () => {
  if ($("liste-tables").value) rejoindre($("liste-tables").value);
});

$("form-table").addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const reponse = await demander(EVENEMENTS.TABLE_CREER, { nom: new FormData(evenement.target).get("nom") });
  if (reponse.ok) evenement.target.reset();
});

$("form-personnage").addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const champs = new FormData(evenement.target);
  const donnees = {
    nom: champs.get("nom"),
    classe: champs.get("classe"),
    ...(champs.get("race") ? { race: champs.get("race") } : {}),
    caracteristiques: Object.fromEntries(CARACTERISTIQUES.map((c) => [c, Number(champs.get(c))])),
  };
  if (estMJ() && champs.get("proprietaire")) donnees.proprietaire = champs.get("proprietaire");
  const reponse = await demander(EVENEMENTS.PERSONNAGE_CREER, { donnees });
  if (reponse.ok) evenement.target.elements.nom.value = "";
});

$("form-des").addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const champs = new FormData(evenement.target);
  const demande = { formule: champs.get("formule"), raison: champs.get("raison") || undefined };
  if (estMJ()) demande.secret = champs.get("secret") === "on";
  demander(EVENEMENTS.DES_LANCER, demande);
});

$("bouton-initiative").addEventListener("click", () => demander(EVENEMENTS.COMBAT_DEMARRER, {}));
$("bouton-tour-suivant").addEventListener("click", () => {
  if (!combat) return journal("Pas de combat en cours.");
  // On precise qui on croit actif : protege contre les doubles clics simultanes.
  demander(EVENEMENTS.COMBAT_TOUR_SUIVANT, { idActif: combat.participants[combat.indexActif].id });
});
$("bouton-tour-precedent").addEventListener("click", () => demander(EVENEMENTS.COMBAT_TOUR_PRECEDENT, {}));
$("bouton-fin-combat").addEventListener("click", () => demander(EVENEMENTS.COMBAT_TERMINER, {}));
$("bouton-ajout-combat").addEventListener("click", () => {
  if ($("choix-ajout-combat").value) demander(EVENEMENTS.COMBAT_AJOUTER, { idPersonnage: $("choix-ajout-combat").value });
});
$("bouton-repos-long-table").addEventListener("click", () => {
  if (confirm("Accorder un repos long a TOUS les personnages de la table ?")) demander(EVENEMENTS.REPOS_LONG, {});
});
$("bouton-recharger-compendium").addEventListener("click", async () => {
  const reponse = await demander(EVENEMENTS.COMPENDIUM_RECHARGER, {});
  if (reponse.ok) afficherErreursCompendium(reponse.rapport);
});
$("bouton-recharger-referentiel").addEventListener("click", async () => {
  const reponse = await demander(EVENEMENTS.REFERENTIEL_RECHARGER, {});
  if (!reponse.ok) return;
  const { rapport } = reponse;
  $("bilan-referentiel").textContent =
    ` ${rapport.factions} faction(s), ${rapport.races} race(s), ${rapport.classes} classe(s), ${rapport.ressources} ressource(s)`;
  $("erreurs-referentiel").replaceChildren(
    ...rapport.erreurs.map((e) =>
      el("li", `ERREUR referentiel${e.fichier ? `/${e.fichier}` : ""} > ${e.emplacement} : ${e.message}`),
    ),
  );
});
// --- Outils de la carte ---
for (const radio of document.querySelectorAll("input[name=outil]")) {
  radio.addEventListener("change", () => moteur?.choisirOutil(radio.value));
}
$("rayon-pinceau").addEventListener("input", () => moteur && (moteur.rayonPinceau = Number($("rayon-pinceau").value)));
$("voir-atravers").addEventListener("change", () => moteur && ((moteur.voirAtravers = $("voir-atravers").checked), (moteur.sale = true)));
$("aimanter").addEventListener("change", () => moteur && (moteur.aimanter = $("aimanter").checked));
$("bouton-recentrer").addEventListener("click", () => moteur?.recentrer());

for (const [curseur, nombre, cle] of [
  ["grille-taille", "grille-taille-n", "taille"],
  ["grille-x", "grille-x-n", "decalageX"],
  ["grille-y", "grille-y-n", "decalageY"],
]) {
  $(curseur).addEventListener("input", () => reglerGrille({ [cle]: Number($(curseur).value) }));
  $(nombre).addEventListener("change", () => reglerGrille({ [cle]: Number($(nombre).value) }));
}
for (const b of document.querySelectorAll("[data-grille]")) {
  b.addEventListener("click", () => reglerGrille({ [b.dataset.grille]: scene.grille[b.dataset.grille] + Number(b.dataset.pas) }));
}
$("grille-visible").addEventListener("change", () => reglerGrille({ visible: $("grille-visible").checked }));

$("bouton-carte").addEventListener("click", () => demander(EVENEMENTS.SCENE_CARTE, { fichier: $("choix-carte").value || null }));
$("bouton-actualiser-cartes").addEventListener("click", chargerListeCartes);
$("bouton-tout-cacher").addEventListener("click", () => {
  if (confirm("Recouvrir toute la carte de brouillard ?")) demander(EVENEMENTS.BROUILLARD_TOUT, { mode: "cacher" });
});
$("bouton-tout-reveler").addEventListener("click", () => demander(EVENEMENTS.BROUILLARD_TOUT, { mode: "reveler" }));
$("brouillard-actif").addEventListener("change", () =>
  demander(EVENEMENTS.BROUILLARD_ACTIF, { actif: $("brouillard-actif").checked }),
);
$("bouton-quete").addEventListener("click", async () => {
  const titre = $("titre-quete").value.trim();
  const objectif = $("objectif-quete").value.trim();
  if (!titre || !objectif) return journal("Indique un titre ET un objectif.");
  const r = await demander(EVENEMENTS.QUETE_AJOUTER, { titre, objectif });
  if (r.ok) {
    $("titre-quete").value = "";
    $("objectif-quete").value = "";
  }
});
$("bouton-placer-tous").addEventListener("click", () => demander(EVENEMENTS.PIONS_PLACER_TOUS, {}));
$("bouton-creer-butin").addEventListener("click", () =>
  demander(EVENEMENTS.BUTIN_CREER, { nom: $("nom-butin").value.trim() || "Coffre", genre: $("genre-butin").value }),
);
$("bouton-placer").addEventListener("click", () => {
  if ($("choix-pion").value) demander(EVENEMENTS.PION_PLACER, { idPersonnage: $("choix-pion").value });
});

// --- Demarrage de la page ----------------------------------------------------------------------

/** Listes deroulantes tirees du referentiel (classes, races) : a chaque chargement ou rechargement. */
function remplirListesReferentiel() {
  $("choix-classe").replaceChildren(
    ...referentiel.classes.map(({ id, nom, deDeVie }) => Object.assign(el("option", `${nom} (d${deDeVie})`), { value: id })),
  );
  $("choix-race").replaceChildren(
    Object.assign(el("option", "(aucune : monstre)"), { value: "" }),
    ...referentiel.races.map(({ id, nom }) => Object.assign(el("option", nom), { value: id })),
  );
}

async function chargerReferentiel() {
  const reponse = await demander(EVENEMENTS.REFERENTIEL_LISTER, {});
  if (!reponse.ok) return;
  referentiel = reponse;
  remplirListesReferentiel();
  afficherPersonnages();
}

const jetonMemorise = memoire.lire(CLE_JETON);
const profilMemorise = memoire.lire(CLE_MOI);
if (jetonMemorise && profilMemorise) demarrerSession(jetonMemorise, JSON.parse(profilMemorise));
else afficherZone("connexion");
