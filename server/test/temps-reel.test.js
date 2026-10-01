// Test d'integration : un VRAI serveur temps reel (Socket.IO), un MJ et deux
// joueurs connectes, comme pendant une partie. On verifie la synchronisation
// ET les protections : ce qu'un joueur n'a pas le droit de faire est refuse,
// ce qu'il n'a pas le droit de voir ne lui est jamais envoye.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { io as connecterSocket } from "socket.io-client";
import { EVENEMENTS } from "../../shared/protocole.js";
import { couleurPour } from "../../shared/couleurs.js";
import { creerGestionnaireSessions } from "../src/auth/sessions.js";
import { creerCompendium } from "../src/donnees/compendium.js";
import { creerDepot } from "../src/donnees/depot.js";
import { creerReferentiel } from "../src/donnees/referentiel.js";
import { installerTempsReel } from "../src/temps-reel/index.js";

const CARAC = { force: 14, dexterite: 12, constitution: 14, intelligence: 10, sagesse: 10, charisme: 8 };
const dossier = mkdtempSync(join(tmpdir(), "vtt-temps-reel-"));
let serveur;
let depot;
let sessions;
let adresse;
let mj;
let thrall;
let jaina;
const perso = {}; // nom -> { id, pion }

const demander = (socket, evenement, donnees = {}) => new Promise((ok) => socket.emit(evenement, donnees, ok));

/** Le prochain message "evenement" recu qui passe le filtre (ou null au bout de "delai" ms). */
function attendre(socket, evenement, delai = 400, filtre = () => true) {
  return new Promise((ok) => {
    const minuterie = setTimeout(() => {
      socket.off(evenement, recu);
      ok(null);
    }, delai);
    const recu = (donnees) => {
      if (!filtre(donnees)) return;
      clearTimeout(minuterie);
      socket.off(evenement, recu);
      ok(donnees);
    };
    socket.on(evenement, recu);
  });
}

async function connecter(sessions, identite) {
  const { jeton } = sessions.connecter(identite, "127.0.0.1");
  const socket = connecterSocket(adresse, { auth: { jeton }, transports: ["websocket"] });
  await new Promise((ok) => socket.on("connect", ok));
  return socket;
}

before(async () => {
  mkdirSync(join(dossier, "parties"));
  depot = creerDepot(join(dossier, "parties"));
  depot.charger();
  sessions = creerGestionnaireSessions({ motDePasseMJ: "secret-de-test" });
  const compendium = creerCompendium("exemples/compendium");
  compendium.charger();
  const referentiel = creerReferentiel("exemples/referentiel");
  referentiel.charger();
  serveur = createServer();
  installerTempsReel(serveur, { depot, sessions, compendium, referentiel, config: { dossiers: {} } });
  await new Promise((ok) => serveur.listen(0, "127.0.0.1", ok));
  adresse = `http://127.0.0.1:${serveur.address().port}`;

  mj = await connecter(sessions, { role: "mj", pseudo: "MJ", motDePasse: "secret-de-test" });
  thrall = await connecter(sessions, { role: "joueur", pseudo: "Thrall" });
  jaina = await connecter(sessions, { role: "joueur", pseudo: "Jaina" });

  // Le MJ prepare la table : deux heros, un monstre, tous poses sur la carte.
  // (Les joueurs entrent ensuite : ils ont deja leur personnage, pas d'ecran de creation.)
  const { table } = await demander(mj, EVENEMENTS.TABLE_CREER, { nom: "Test" });
  await demander(mj, EVENEMENTS.TABLE_REJOINDRE, { idTable: table.id });
  for (const [nom, proprietaire] of [["Garrosh", "Thrall"], ["Antonidas", "Jaina"], ["Gnoll", undefined]]) {
    const r = await demander(mj, EVENEMENTS.PERSONNAGE_CREER, {
      donnees: { nom, classe: "guerrier", niveau: 1, caracteristiques: CARAC, ...(proprietaire && { proprietaire }) },
    });
    perso[nom] = { id: r.personnage.id };
  }
  await demander(mj, EVENEMENTS.PIONS_PLACER_TOUS);
  for (const socket of [thrall, jaina]) await demander(socket, EVENEMENTS.TABLE_REJOINDRE, { idTable: table.id });
  for (const pion of depot.obtenirScene(table.id).pions) {
    const nom = Object.keys(perso).find((n) => perso[n].id === pion.idPersonnage);
    perso[nom].pion = pion.id;
  }
});

after(() => {
  for (const socket of [mj, thrall, jaina]) socket?.close();
  serveur?.close();
  depot?.vider();
  rmSync(dossier, { recursive: true, force: true });
});

// --- 1. Deplacement des pions ----------------------------------------------------------

test("un joueur deplace SON pion : les autres le voient glisser, le serveur aimante la position finale", async () => {
  const idPion = perso.Garrosh.pion;
  assert.equal((await demander(thrall, EVENEMENTS.PION_SAISIR, { idPion })).ok, true);

  const vuParJaina = attendre(jaina, EVENEMENTS.PION_POSITION);
  await demander(thrall, EVENEMENTS.PION_DEPLACER, { idPion, x: 713, y: 488, final: false });
  assert.deepEqual(await vuParJaina, { idPion, x: 713, y: 488, final: false, par: "Thrall" });

  const vuParMJ = attendre(mj, EVENEMENTS.PION_POSITION);
  const r = await demander(thrall, EVENEMENTS.PION_DEPLACER, { idPion, x: 713, y: 488, final: true });
  // Grille de 100 px : le centre de case le plus proche est (750, 450).
  assert.deepEqual(r.position, { x: 750, y: 450 });
  assert.equal((await vuParMJ).final, true);
});

test("un joueur ne peut saisir ni le pion d'un autre joueur, ni celui d'un monstre", async () => {
  for (const nom of ["Antonidas", "Gnoll"]) {
    const saisie = await demander(thrall, EVENEMENTS.PION_SAISIR, { idPion: perso[nom].pion });
    assert.deepEqual(saisie, { ok: false, erreur: "Tu ne peux deplacer que le pion de ton personnage." });
    const deplacement = await demander(thrall, EVENEMENTS.PION_DEPLACER, { idPion: perso[nom].pion, x: 0, y: 0, final: true });
    assert.equal(deplacement.ok, false);
  }
});

test("le MJ deplace n'importe quel pion ; hors de la carte, le pion est ramene au bord", async () => {
  await demander(mj, EVENEMENTS.PION_SAISIR, { idPion: perso.Gnoll.pion });
  const r = await demander(mj, EVENEMENTS.PION_DEPLACER, { idPion: perso.Gnoll.pion, x: 99_999, y: -500, final: true, aimanter: false });
  assert.deepEqual(r.position, { x: 2000, y: 0 });
});

test("deux personnes ne tirent jamais le meme pion (verrou)", async () => {
  const idPion = perso.Antonidas.pion;
  assert.equal((await demander(mj, EVENEMENTS.PION_SAISIR, { idPion })).ok, true);
  const refus = await demander(jaina, EVENEMENTS.PION_SAISIR, { idPion });
  assert.deepEqual(refus, { ok: false, erreur: "Maitre du Jeu deplace deja ce pion." });
  await demander(mj, EVENEMENTS.PION_DEPLACER, { idPion, x: 1050, y: 1050, final: true }); // libere le verrou
});

test("un monstre cache dans le brouillard ne trahit jamais sa position aux joueurs", async () => {
  // Brouillard actif, rien de revele : le Gnoll est invisible pour les joueurs.
  const vuParThrall = attendre(thrall, EVENEMENTS.PION_POSITION, 300, (m) => m.idPion === perso.Gnoll.pion);
  await demander(mj, EVENEMENTS.PION_SAISIR, { idPion: perso.Gnoll.pion });
  await demander(mj, EVENEMENTS.PION_DEPLACER, { idPion: perso.Gnoll.pion, x: 1500, y: 500, final: false });
  await demander(mj, EVENEMENTS.PION_DEPLACER, { idPion: perso.Gnoll.pion, x: 1500, y: 500, final: true });
  assert.equal(await vuParThrall, null);
});

// --- 2. Dessin tactique ------------------------------------------------------------------

test("ping : les autres le recoivent, avec la couleur du joueur ; l'envoyeur, non (il l'a deja dessine)", async () => {
  const chezJaina = attendre(jaina, EVENEMENTS.CARTE_PING_RECU);
  const chezThrall = attendre(thrall, EVENEMENTS.CARTE_PING_RECU, 250);
  assert.equal((await demander(thrall, EVENEMENTS.CARTE_PING, { x: 300, y: -20 })).ok, true);
  assert.deepEqual(await chezJaina, { x: 300, y: 0, couleur: couleurPour("Thrall"), par: "Thrall" });
  assert.equal(await chezThrall, null);
});

test("ping : une rafale envoyee par un script est bloquee", async () => {
  const reponses = [];
  for (let i = 0; i < 6; i++) reponses.push(await demander(jaina, EVENEMENTS.CARTE_PING, { x: 10, y: 10 }));
  assert.ok(reponses.some((r) => r.erreur === "Doucement avec les pings !"));
});

test("trace : relayee en direct, au nom de son auteur ; chacun n'efface que les siennes", async () => {
  const chezMJ = attendre(mj, EVENEMENTS.DESSIN_AJOUTE);
  const r = await demander(thrall, EVENEMENTS.DESSIN_TRAIT, { cle: "chemin01", couleur: "#ff3b30", points: [[100, 100], [200, 150]] });
  assert.equal(r.id, "thrall:chemin01");
  assert.deepEqual(await chezMJ, { id: "thrall:chemin01", auteur: "Thrall", couleur: "#ff3b30", points: [[100, 100], [200, 150]] });
  await demander(mj, EVENEMENTS.DESSIN_TRAIT, { cle: "fleche01", couleur: "#ffd100", points: [[5, 5]] });

  // Un joueur ne peut pas tout effacer...
  assert.deepEqual(await demander(thrall, EVENEMENTS.DESSIN_EFFACER, { tout: true }), {
    ok: false,
    erreur: "Seul le MJ peut effacer les traces des autres.",
  });
  // ... mais il efface les siennes, et seulement les siennes.
  const etat = attendre(jaina, EVENEMENTS.DESSINS_ETAT);
  await demander(thrall, EVENEMENTS.DESSIN_EFFACER, {});
  assert.deepEqual((await etat).traces.map((t) => t.id), ["maitre du jeu:fleche01"]);
});

test("trace : un arrivant (ou un F5) retrouve les traces deja dessinees", async () => {
  const idTable = depot.listerTables()[0].id;
  const r = await demander(jaina, EVENEMENTS.TABLE_REJOINDRE, { idTable });
  assert.deepEqual(r.traces.map((t) => t.id), ["maitre du jeu:fleche01"]);
});

// --- 3. Textes de combat flottants ---------------------------------------------------------

test("degats critiques sur un heros : toute la table voit les gros chiffres jaunes", async () => {
  const [chezJaina, chezMJ] = [attendre(jaina, EVENEMENTS.COMBAT_TEXTE), attendre(mj, EVENEMENTS.COMBAT_TEXTE)];
  await demander(mj, EVENEMENTS.PERSONNAGE_MODIFIER_PV, { idPersonnage: perso.Garrosh.id, type: "degats", montant: 7, critique: true });
  const attendu = { idPersonnage: perso.Garrosh.id, genre: "degats", montant: 7, critique: true, absorbe: 0 };
  assert.deepEqual(await chezJaina, attendu);
  assert.deepEqual(await chezMJ, attendu);
});

test("soins : le montant reellement rendu, en vert", async () => {
  const chezThrall = attendre(thrall, EVENEMENTS.COMBAT_TEXTE, 400, (m) => m.genre === "soins");
  await demander(thrall, EVENEMENTS.PERSONNAGE_MODIFIER_PV, { idPersonnage: perso.Garrosh.id, type: "soins", montant: 50 });
  assert.deepEqual(await chezThrall, { idPersonnage: perso.Garrosh.id, genre: "soins", montant: 7, critique: false, absorbe: 0 });
});

test("un monstre dans le brouillard : seul le MJ voit ses chiffres ; une fois revele, tout le monde", async () => {
  const touche = () => demander(mj, EVENEMENTS.PERSONNAGE_MODIFIER_PV, { idPersonnage: perso.Gnoll.id, type: "degats", montant: 3 });
  const duGnoll = (m) => m.idPersonnage === perso.Gnoll.id;
  let [chezThrall, chezMJ] = [attendre(thrall, EVENEMENTS.COMBAT_TEXTE, 300, duGnoll), attendre(mj, EVENEMENTS.COMBAT_TEXTE, 400, duGnoll)];
  await touche();
  assert.equal(await chezThrall, null);
  assert.equal((await chezMJ).montant, 3);

  await demander(mj, EVENEMENTS.BROUILLARD_TOUT, { mode: "reveler" });
  chezThrall = attendre(thrall, EVENEMENTS.COMBAT_TEXTE, 400, duGnoll);
  await touche();
  assert.equal((await chezThrall).montant, 3);
});

test("un joueur ne peut pas blesser le personnage d'un autre", async () => {
  const r = await demander(thrall, EVENEMENTS.PERSONNAGE_MODIFIER_PV, { idPersonnage: perso.Antonidas.id, type: "degats", montant: 5 });
  assert.equal(r.ok, false);
});

// --- 4. Premiere connexion : l'ecran de creation --------------------------------------------

test("premiere connexion : un joueur sans personnage reste a la porte, puis entre en jeu apres sa creation", async () => {
  const sylvanas = await connecter(sessions, { role: "joueur", pseudo: "Sylvanas" });
  try {
    const idTable = depot.listerTables()[0].id;

    // 1. Aiguillage : pas de personnage ici -> ecran de creation, et RIEN de la table.
    const porte = await demander(sylvanas, EVENEMENTS.TABLE_REJOINDRE, { idTable });
    assert.equal(porte.creationRequise, true);
    assert.equal(porte.scene, undefined);
    assert.equal(porte.personnages, undefined);
    // Il n'est pas dans les salons : il ne peut ni pinguer, ni recevoir ce qui s'y passe.
    assert.deepEqual(await demander(sylvanas, EVENEMENTS.CARTE_PING, { x: 1, y: 1 }), { ok: false, erreur: "Rejoins d'abord une table." });
    const fuite = attendre(sylvanas, EVENEMENTS.COMBAT_TEXTE, 250);
    await demander(mj, EVENEMENTS.PERSONNAGE_MODIFIER_PV, { idPersonnage: perso.Garrosh.id, type: "degats", montant: 1 });
    assert.equal(await fuite, null);
    // Et il ne peut pas contourner l'ecran avec la creation libre du MJ.
    const libre = await demander(sylvanas, EVENEMENTS.PERSONNAGE_CREER, { donnees: { nom: "X", classe: "guerrier", caracteristiques: CARAC } });
    assert.deepEqual(libre, { ok: false, erreur: "Cree ton personnage depuis l'ecran de creation." });

    // 2. Choix refuses par le serveur (restriction de race lue dans races.json).
    const choix = {
      nom: "Sylvanas",
      faction: "horde",
      race: "mort-vivant",
      classe: "rodeur",
      methode: "achat-de-points",
      caracteristiques: { force: 8, dexterite: 15, constitution: 14, intelligence: 10, sagesse: 14, charisme: 8 },
    };
    const refus = await demander(sylvanas, EVENEMENTS.CREATION_VALIDER, { donnees: { ...choix, classe: "druide" } });
    assert.deepEqual(refus, { ok: false, erreur: "Mort-vivant : la classe Druide n'est pas accessible a cette race." });

    // 3. "Entrer dans le monde" : la table voit arriver le personnage...
    const annonce = attendre(thrall, EVENEMENTS.PERSONNAGE_MAJ, 400, (m) => m.cause.action === "creation");
    const entree = await demander(sylvanas, EVENEMENTS.CREATION_VALIDER, { donnees: choix });
    assert.equal(entree.ok, true);
    assert.equal(entree.creationRequise, false);
    assert.equal((await annonce).personnage.nom, "Sylvanas");
    // ... et le joueur recoit tout ce qu'il faut pour jouer, pion compris.
    const fiche = entree.personnages.find((p) => p.proprietaire === "Sylvanas");
    assert.deepEqual([fiche.race, fiche.classe, fiche.caracteristiques.constitution], ["mort-vivant", "rodeur", 16]);
    const pion = entree.scene.pions.find((p) => p.idPersonnage === fiche.id);
    assert.ok(pion, "son pion est pose sur la carte");
    assert.ok(!entree.scene.pions.some((p) => p !== pion && p.x === pion.x && p.y === pion.y), "sur une case libre");
    // Desormais, il est en jeu : il peut pinguer.
    assert.equal((await demander(sylvanas, EVENEMENTS.CARTE_PING, { x: 1, y: 1 })).ok, true);

    // 4. Un seul personnage par table ; au retour (F5), il entre directement.
    const doublon = await demander(sylvanas, EVENEMENTS.CREATION_VALIDER, { donnees: choix });
    assert.equal(doublon.ok, false);
    assert.equal((await demander(sylvanas, EVENEMENTS.TABLE_REJOINDRE, { idTable })).creationRequise, false);
  } finally {
    sylvanas.close();
  }
});

test("l'ecran de creation est reserve aux joueurs", async () => {
  const r = await demander(mj, EVENEMENTS.CREATION_VALIDER, { donnees: {} });
  assert.deepEqual(r, { ok: false, erreur: "Le MJ cree ses personnages depuis les outils du MJ." });
});

// --- 5. Le sac est prive ------------------------------------------------------------------

test("le contenu d'un sac ne part qu'a son proprietaire et au MJ, jamais aux autres joueurs", async () => {
  const pourGarrosh = (m) => m.personnage.id === perso.Garrosh.id && m.cause.action === "objet-recu";
  const [chezThrall, chezJaina, chezMJ] = [thrall, jaina, mj].map((s) => attendre(s, EVENEMENTS.PERSONNAGE_MAJ, 400, pourGarrosh));
  const r = await demander(mj, EVENEMENTS.INVENTAIRE_AJOUTER, { idPersonnage: perso.Garrosh.id, idObjet: "epee-longue" });
  assert.equal(r.ok, true);

  // Le proprietaire et le MJ voient l'epee dans le sac...
  assert.deepEqual((await chezThrall).personnage.inventaire.map((o) => o.nom), ["Epee longue"]);
  assert.deepEqual((await chezMJ).personnage.inventaire.map((o) => o.nom), ["Epee longue"]);
  // ... Jaina recoit la fiche (caracteristiques, PV...) SANS le contenu du sac.
  const vuParJaina = (await chezJaina).personnage;
  assert.deepEqual([vuParJaina.inventaire, vuParJaina.sacPrive], [[], true]);
  assert.equal(vuParJaina.pointsDeVie.max, (await chezThrall).personnage.pointsDeVie.max);

  // Meme regle a l'arrivee a la table (ou apres un F5).
  const idTable = depot.listerTables()[0].id;
  const fiches = async (socket) => (await demander(socket, EVENEMENTS.TABLE_REJOINDRE, { idTable })).personnages;
  assert.equal((await fiches(jaina)).find((p) => p.id === perso.Garrosh.id).inventaire.length, 0);
  assert.equal((await fiches(thrall)).find((p) => p.id === perso.Garrosh.id).inventaire.length, 1);
  // Jaina voit toujours son propre sac.
  assert.equal((await fiches(jaina)).find((p) => p.id === perso.Antonidas.id).sacPrive, undefined);
});

// --- 6. Equipement, barre d'actions, butin (sprint 7) ------------------------------------------

const idTableTest = () => depot.listerTables()[0].id;
const fiche = (nom) => depot.obtenirPersonnage(perso[nom].id);
const pionDe = (nom) => depot.obtenirScene(idTableTest()).pions.find((p) => p.idPersonnage === perso[nom].id);

test("equiper un bouclier : CA +2 recalculee par le serveur, et visible des autres (pas le sac)", async () => {
  await demander(mj, EVENEMENTS.INVENTAIRE_AJOUTER, { idPersonnage: perso.Garrosh.id, idObjet: "bouclier-de-hurlevent" });
  const bouclier = fiche("Garrosh").inventaire.find((o) => o.source === "bouclier-de-hurlevent");
  const avant = fiche("Garrosh").classeArmure;

  // Jaina ne peut pas equiper le personnage de Thrall.
  const intrus = await demander(jaina, EVENEMENTS.EQUIPER, { idPersonnage: perso.Garrosh.id, idObjet: bouclier.id });
  assert.deepEqual(intrus, { ok: false, erreur: "Ce personnage ne t'appartient pas." });

  const vuParJaina = attendre(jaina, EVENEMENTS.PERSONNAGE_MAJ, 400, (m) => m.cause.action === "equipe");
  const r = await demander(thrall, EVENEMENTS.EQUIPER, { idPersonnage: perso.Garrosh.id, idObjet: bouclier.id, emplacement: "main-gauche" });
  assert.equal(r.personnage.classeArmure, avant + 2);
  const chezJaina = (await vuParJaina).personnage;
  assert.equal(chezJaina.classeArmure, avant + 2);
  assert.equal(chezJaina.equipement["main-gauche"].nom, "Bouclier de Hurlevent"); // l'equipement se voit ("Inspecter")
  assert.deepEqual(chezJaina.inventaire, []); // le sac, non

  const mauvais = await demander(thrall, EVENEMENTS.EQUIPER, {
    idPersonnage: perso.Garrosh.id,
    idObjet: fiche("Garrosh").inventaire.find((o) => o.source === "epee-longue").id,
    emplacement: "tete",
  });
  assert.equal(mauvais.erreur, "Epee longue ne se porte pas a cet emplacement (Tete).");
});

test("barre d'actions : un raccourci de potion, qu'on boit d'un clic", async () => {
  await demander(mj, EVENEMENTS.PERSONNAGE_MODIFIER_PV, { idPersonnage: perso.Garrosh.id, type: "degats", montant: 6 });
  await demander(mj, EVENEMENTS.INVENTAIRE_AJOUTER, { idPersonnage: perso.Garrosh.id, idObjet: "potion-de-soins", quantite: 2 });
  const raccourci = { type: "objet", reference: "potion-de-soins" };
  const pose = await demander(thrall, EVENEMENTS.BARRE_DEFINIR, { idPersonnage: perso.Garrosh.id, index: 0, raccourci });
  assert.deepEqual(pose.personnage.barreActions[0], raccourci);
  // Un objet qui ne s'utilise pas n'a pas sa place dans la barre.
  const bouclier = await demander(thrall, EVENEMENTS.BARRE_DEFINIR, { idPersonnage: perso.Garrosh.id, index: 1, raccourci: { type: "objet", reference: "chope-ebrechee" } });
  assert.equal(bouclier.ok, false);

  const pvAvant = fiche("Garrosh").pointsDeVie.actuels;
  const texte = attendre(jaina, EVENEMENTS.COMBAT_TEXTE, 400, (m) => m.idPersonnage === perso.Garrosh.id && m.genre === "soins");
  const bu = await demander(thrall, EVENEMENTS.OBJET_UTILISER, { idPersonnage: perso.Garrosh.id, reference: "potion-de-soins" });
  assert.equal(bu.ok, true);
  assert.ok(bu.personnage.pointsDeVie.actuels > pvAvant);
  assert.equal(bu.personnage.inventaire.find((o) => o.source === "potion-de-soins").quantite, 1);
  assert.ok(await texte, "le soin flotte au-dessus du pion, chez tout le monde");
});

test("une arme equipee ouvre la fenetre de resolution : le serveur lance, detaille, le joueur valide", async () => {
  const epee = fiche("Garrosh").inventaire.find((o) => o.source === "epee-longue");
  const pasEquipee = await demander(thrall, EVENEMENTS.OBJET_UTILISER, { idPersonnage: perso.Garrosh.id, reference: "epee-longue" });
  assert.equal(pasEquipee.erreur, "Equipe d'abord Epee longue pour attaquer avec.");
  await demander(thrall, EVENEMENTS.EQUIPER, { idPersonnage: perso.Garrosh.id, idObjet: epee.id, emplacement: "main-droite" });

  // 1. Le joueur attaque : le MJ voit la fenetre s'ouvrir chez lui aussi.
  const chezMJ = attendre(mj, EVENEMENTS.JET_EN_COURS);
  const { jet } = await demander(thrall, EVENEMENTS.OBJET_UTILISER, { idPersonnage: perso.Garrosh.id, reference: "epee-longue" });
  assert.equal((await chezMJ).jet.id, jet.id);
  assert.equal(jet.action.nom, "Epee longue");
  const [attaque] = jet.lignes;
  // Garrosh : Force 14 (+2), niveau 1 (maitrise +2) : d20 + Force + Maitrise.
  assert.deepEqual(attaque.modificateurs, [{ nom: "Force", valeur: 2 }, { nom: "Maitrise", valeur: 2 }]);
  assert.equal(attaque.total, attaque.d20 + 4);

  // 2. Pas de second jet tant que le premier n'est pas valide (on ne relance pas pour un 20).
  const relance = await demander(thrall, EVENEMENTS.OBJET_UTILISER, { idPersonnage: perso.Garrosh.id, reference: "epee-longue" });
  assert.equal(relance.erreur, "Valide d'abord le jet en cours.");
  // Jaina ne peut pas valider le jet de Thrall.
  assert.equal((await demander(jaina, EVENEMENTS.JET_VALIDER, { idJet: jet.id })).erreur, "Ce n'est pas ton jet.");

  // 3. "Valider" : toute la table recoit le resultat, avec les memes chiffres.
  const annonce = attendre(jaina, EVENEMENTS.JET_RESULTAT);
  assert.equal((await demander(thrall, EVENEMENTS.JET_VALIDER, { idJet: jet.id })).ok, true);
  const resultat = (await annonce).jet;
  assert.deepEqual([resultat.statut, resultat.lignes[0].total], ["valide", attaque.total]);
});

test("butin : a distance on ne voit que le coffre ; a cote, on fouille ; jamais de double pillage", async () => {
  const g = pionDe("Garrosh");
  const { butin } = await demander(mj, EVENEMENTS.BUTIN_CREER, { nom: "Coffre du gnoll", x: g.x + 100, y: g.y });
  await demander(mj, EVENEMENTS.BUTIN_AJOUTER, { idButin: butin.id, idObjet: "lame-des-cendres" });

  // Ce que les joueurs recoivent de la carte : le coffre, sans son contenu.
  const vue = (await demander(jaina, EVENEMENTS.TABLE_REJOINDRE, { idTable: idTableTest() })).scene.butins.find((b) => b.id === butin.id);
  assert.deepEqual([vue.nom, vue.vide, vue.objets], ["Coffre du gnoll", false, undefined]);

  // Antonidas est loin : Jaina ne peut pas fouiller.
  const loin = await demander(jaina, EVENEMENTS.BUTIN_OUVRIR, { idButin: butin.id });
  assert.equal(loin.erreur, "Approche-toi : il faut etre a 2 cases au plus pour fouiller.");

  // Le MJ approche Antonidas : les deux heros sont a cote du coffre.
  const a = pionDe("Antonidas");
  await demander(mj, EVENEMENTS.PION_SAISIR, { idPion: a.id });
  await demander(mj, EVENEMENTS.PION_DEPLACER, { idPion: a.id, x: g.x + 200, y: g.y, final: true });
  const [ouvertThrall, ouvertJaina] = await Promise.all([thrall, jaina].map((s) => demander(s, EVENEMENTS.BUTIN_OUVRIR, { idButin: butin.id })));
  const idObjet = ouvertThrall.butin.objets[0].id;
  assert.equal(ouvertJaina.butin.objets[0].nom, "Lame des Cendres");

  // Les deux cliquent au meme instant : un seul l'obtient.
  const majChezJaina = attendre(jaina, EVENEMENTS.BUTIN_MAJ, 400, (m) => m.idButin === butin.id);
  const reponses = await Promise.all([thrall, jaina].map((s) => demander(s, EVENEMENTS.BUTIN_PRENDRE, { idButin: butin.id, idObjet })));
  assert.deepEqual(reponses.map((r) => r.ok).sort(), [false, true]);
  assert.equal(reponses.find((r) => !r.ok).erreur, "Quelqu'un a deja pris cet objet.");
  assert.deepEqual((await majChezJaina).butin.objets, []); // sa fenetre se vide en direct
  const gagnant = reponses[0].ok ? "Garrosh" : "Antonidas";
  assert.ok(fiche(gagnant).inventaire.some((o) => o.nom === "Lame des Cendres"));
});

test("le MJ transforme un monstre en cadavre : ce qu'il portait devient du butin", async () => {
  await demander(mj, EVENEMENTS.INVENTAIRE_AJOUTER, { idPersonnage: perso.Gnoll.id, idObjet: "chope-ebrechee" });
  const refus = await demander(thrall, EVENEMENTS.PION_EN_CADAVRE, { idPion: pionDe("Gnoll").id });
  assert.equal(refus.ok, false);
  assert.equal((await demander(mj, EVENEMENTS.PION_EN_CADAVRE, { idPion: pionDe("Gnoll").id })).ok, true);

  const scene = depot.obtenirScene(idTableTest());
  const cadavre = scene.butins.find((b) => b.genre === "cadavre");
  assert.equal(cadavre.nom, "Cadavre : Gnoll");
  assert.deepEqual(cadavre.objets.map((o) => o.nom), ["Chope ebrechee"]);
  assert.equal(pionDe("Gnoll"), undefined);
  assert.deepEqual(fiche("Gnoll").inventaire, []);
});

// --- 7. Magie, quetes, repos (sprint 8) ------------------------------------------------------

test("sorts : niveau, cout en Mana et fenetre de resolution", async () => {
  for (const idSort of ["trait-de-feu", "projectile-magique", "boule-de-feu"]) {
    await demander(mj, EVENEMENTS.GRIMOIRE_APPRENDRE, { idPersonnage: perso.Antonidas.id, idSort });
  }
  // Boule de feu (niveau 3) : hors de portee d'un personnage de niveau 1.
  const tropHaut = await demander(jaina, EVENEMENTS.SORT_LANCER, { idPersonnage: perso.Antonidas.id, reference: "boule-de-feu" });
  assert.match(tropHaut.erreur, /encore hors de portee/);
  // Projectile magique coute du Mana : Antonidas (guerrier) n'en a pas.
  const sansMana = await demander(jaina, EVENEMENTS.SORT_LANCER, { idPersonnage: perso.Antonidas.id, reference: "projectile-magique" });
  assert.equal(sansMana.erreur, "Antonidas n'a pas de Mana pour lancer Projectile magique.");
  // Trait de feu (mineur, gratuit) : jet d'attaque de sort detaille.
  const { jet } = await demander(jaina, EVENEMENTS.SORT_LANCER, { idPersonnage: perso.Antonidas.id, reference: "trait-de-feu" });
  assert.equal(jet.action.genre, "sort");
  assert.deepEqual(jet.lignes[0].modificateurs.map((m) => m.nom), ["Intelligence", "Maitrise"]);
  assert.equal((await demander(jaina, EVENEMENTS.JET_VALIDER, { idJet: jet.id })).ok, true);
  // Un sort peut aller dans la barre d'actions.
  const barre = await demander(jaina, EVENEMENTS.BARRE_DEFINIR, { idPersonnage: perso.Antonidas.id, index: 2, raccourci: { type: "sort", reference: "trait-de-feu" } });
  assert.deepEqual(barre.personnage.barreActions[2], { type: "sort", reference: "trait-de-feu" });
});

test("tests et sauvegardes : le serveur lit le bonus dans la fiche (lanceur de des)", async () => {
  const pasLeSien = await demander(thrall, EVENEMENTS.TEST_LANCER, { idPersonnage: perso.Antonidas.id, genre: "caracteristique", caracteristique: "force" });
  assert.equal(pasLeSien.ok, false);

  // Sauvegarde de Constitution d'un guerrier : maitrisee (classes.json) -> + Maitrise.
  const chezMJ = attendre(mj, EVENEMENTS.JET_EN_COURS);
  const { jet } = await demander(jaina, EVENEMENTS.TEST_LANCER, { idPersonnage: perso.Antonidas.id, genre: "sauvegarde", caracteristique: "constitution" });
  assert.equal(jet.action.nom, "Sauvegarde de Constitution");
  assert.deepEqual(jet.lignes[0].modificateurs.map((m) => m.nom), ["Constitution", "Maitrise"]);
  assert.equal((await chezMJ).jet.id, jet.id); // le MJ voit le jet aussitot
  const second = await demander(jaina, EVENEMENTS.TEST_LANCER, { idPersonnage: perso.Antonidas.id, genre: "caracteristique", caracteristique: "force" });
  assert.equal(second.erreur, "Valide d'abord le jet en cours.");
  await demander(jaina, EVENEMENTS.JET_VALIDER, { idJet: jet.id });

  // Test de Dexterite avec avantage : deux d20, le meilleur est garde ; pas de maitrise.
  const avantage = await demander(jaina, EVENEMENTS.TEST_LANCER, {
    idPersonnage: perso.Antonidas.id,
    genre: "caracteristique",
    caracteristique: "dexterite",
    avantage: "avantage",
  });
  const ligne = avantage.jet.lignes[0];
  assert.match(ligne.libelle, /\(avantage\)/);
  assert.ok(ligne.d20 >= ligne.d20Ecarte);
  assert.deepEqual(ligne.modificateurs.map((m) => m.nom), ["Dexterite"]);
  await demander(jaina, EVENEMENTS.JET_VALIDER, { idJet: avantage.jet.id });
});

test("quetes : le MJ en pousse une, tous les joueurs la recoivent ; lecture seule pour eux", async () => {
  const refus = await demander(thrall, EVENEMENTS.QUETE_AJOUTER, { titre: "Triche", objectif: "x" });
  assert.equal(refus.erreur, "Seul le MJ peut donner une quete.");

  const [chezThrall, chezJaina] = [thrall, jaina].map((s) => attendre(s, EVENEMENTS.QUETES_ETAT));
  const { quete } = await demander(mj, EVENEMENTS.QUETE_AJOUTER, { titre: "La mine des Mortemines", objectif: "Retrouver le contremaitre Edwin VanCleef." });
  for (const recu of [await chezThrall, await chezJaina]) {
    assert.deepEqual(recu.quetes.map((q) => q.titre), ["La mine des Mortemines"]);
    assert.equal(recu.cause.action, "nouvelle");
  }
  // Elle est sauvegardee : un joueur qui arrive (ou fait F5) la retrouve.
  const idTable = depot.listerTables()[0].id;
  assert.equal((await demander(jaina, EVENEMENTS.TABLE_REJOINDRE, { idTable })).quetes[0].statut, "en-cours");
  const fin = attendre(thrall, EVENEMENTS.QUETES_ETAT);
  await demander(mj, EVENEMENTS.QUETE_MODIFIER, { idQuete: quete.id, statut: "terminee" });
  assert.equal((await fin).quetes[0].statut, "terminee");
});

test("repos long : le portrait passe 'repose' ; le premier coup recu y met fin", async () => {
  await demander(mj, EVENEMENTS.REPOS_LONG, { idPersonnage: perso.Garrosh.id });
  assert.equal(fiche("Garrosh").repose, true);
  await demander(mj, EVENEMENTS.PERSONNAGE_MODIFIER_PV, { idPersonnage: perso.Garrosh.id, type: "degats", montant: 1 });
  assert.equal(fiche("Garrosh").repose, false);
});
