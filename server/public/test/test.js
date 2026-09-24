// Banc de test du sprint 1. Volontairement brut : aucun style, aucun framework.
// Ce navigateur ne calcule RIEN : il envoie des demandes et affiche ce que le
// serveur lui renvoie. Si deux navigateurs affichent la meme chose, le temps
// reel et l'autorite du serveur fonctionnent.
import { EVENEMENTS, ROLES, TYPES_PV } from "/partage/protocole.js";
import { CARACTERISTIQUES, CLASSES } from "/partage/dnd5e.js";

const $ = (id) => document.getElementById(id);
const CLE_JETON = "vtt-jeton";
const CLE_TABLE = "vtt-table";

let socket = null;
let moi = null;
const personnages = new Map();

// --- Memoire de l'onglet ------------------------------------------------------
// sessionStorage = propre a CET onglet : tu peux ouvrir un onglet MJ et un
// onglet joueur dans le meme navigateur pour tester.
const memoire = {
  lire: (cle) => {
    try {
      return sessionStorage.getItem(cle);
    } catch {
      return null;
    }
  },
  ecrire: (cle, valeur) => {
    try {
      if (valeur === null) sessionStorage.removeItem(cle);
      else sessionStorage.setItem(cle, valeur);
    } catch {
      /* navigation privee stricte : on s'en passe */
    }
  },
};

// --- Affichage ---------------------------------------------------------------------
// On n'utilise jamais innerHTML avec des textes venant des joueurs : un pseudo
// comme "<script>..." s'afficherait tel quel au lieu de s'executer (securite).
function element(balise, texte) {
  const noeud = document.createElement(balise);
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function journal(texte) {
  const ligne = element("li", `[${new Date().toLocaleTimeString("fr-FR")}] ${texte}`);
  $("journal").prepend(ligne);
}

function afficherZone(zone) {
  $("zone-connexion").hidden = zone !== "connexion";
  $("zone-tables").hidden = zone === "connexion";
  $("zone-jeu").hidden = zone !== "jeu";
}

function afficherElementsMJ() {
  for (const noeud of document.querySelectorAll("[data-mj-seulement]")) {
    noeud.hidden = moi?.role !== ROLES.MJ;
  }
}

function signe(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function afficherPersonnages() {
  const liste = $("liste-personnages");
  liste.replaceChildren();

  if (personnages.size === 0) liste.append(element("li", "(aucun personnage)"));

  for (const p of personnages.values()) {
    const pv = p.pointsDeVie;
    const caracs = CARACTERISTIQUES.map(
      (c) => `${c.slice(0, 3).toUpperCase()} ${p.caracteristiques[c]} (${signe(p.derives.modificateurs[c])})`,
    ).join(", ");
    const ressources = p.ressources.map((r) => `${r.nom} ${r.actuel}/${r.max}`).join(", ") || "aucune";

    const ligne = element("li");
    ligne.append(
      element("strong", p.nom),
      ` - ${CLASSES[p.classe].nom} niv. ${p.niveau} - joueur : ${p.proprietaire ?? "PNJ (cache)"}`,
      element("br"),
      `PV ${pv.actuels}/${pv.max}${pv.temporaires ? ` (+${pv.temporaires} temp.)` : ""} - CA ${p.classeArmure}` +
        ` - Maitrise ${signe(p.derives.bonusDeMaitrise)} - Des de vie ${p.desDeVie.restants}d${p.desDeVie.faces}`,
      element("br"),
      caracs,
      element("br"),
      `Ressources : ${ressources} - Inventaire : ${p.inventaire.length} objet(s)`,
      element("br"),
    );

    // Controles des PV : visibles pour tous, mais le SERVEUR refusera si ce
    // n'est pas ton personnage. C'est voulu : essaie, pour verifier !
    const montant = element("input");
    montant.type = "number";
    montant.min = "0";
    montant.value = "5";
    montant.size = 4;
    const bouton = (texte, type) => {
      const b = element("button", texte);
      b.addEventListener("click", () => {
        demander(EVENEMENTS.PERSONNAGE_MODIFIER_PV, {
          idPersonnage: p.id,
          type,
          montant: Number(montant.value),
        });
      });
      return b;
    };
    const supprimer = element("button", "Supprimer");
    supprimer.addEventListener("click", () => {
      if (confirm(`Supprimer ${p.nom} ? (la fiche part dans la corbeille)`)) {
        demander(EVENEMENTS.PERSONNAGE_SUPPRIMER, { idPersonnage: p.id });
      }
    });

    ligne.append(
      "Montant : ",
      montant,
      " ",
      bouton("Degats", TYPES_PV.DEGATS),
      bouton("Soins", TYPES_PV.SOINS),
      bouton("PV temporaires", TYPES_PV.TEMPORAIRES),
      " ",
      supprimer,
    );
    liste.append(ligne);
  }
}

// --- Communication avec le serveur ---------------------------------------------------

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
  choix.replaceChildren(
    ...tables.map((t) => {
      const option = element("option", t.nom);
      option.value = t.id;
      return option;
    }),
  );
  if (tables.length === 0) choix.append(element("option", "(aucune table : le MJ doit en creer une)"));
  if (precedent) choix.value = precedent;
}

async function rejoindre(idTable) {
  const reponse = await demander(EVENEMENTS.TABLE_REJOINDRE, { idTable });
  if (!reponse.ok) {
    memoire.ecrire(CLE_TABLE, null);
    return;
  }
  memoire.ecrire(CLE_TABLE, idTable);
  $("nom-table").textContent = reponse.table.nom;
  personnages.clear();
  for (const p of reponse.personnages) personnages.set(p.id, p);
  afficherPersonnages();
  afficherZone("jeu");
  journal(`Table "${reponse.table.nom}" rejointe (${reponse.personnages.length} personnage(s) visible(s)).`);
}

function brancherSocket(jeton) {
  // io() se connecte au serveur qui a servi cette page : ton PC, en direct ou
  // a travers le tunnel. Le jeton est presente a l'entree.
  socket = io({ auth: { jeton } });

  socket.on("connect", async () => {
    $("statut").textContent = "connecte";
    journal("Liaison temps reel etablie.");
    await listerTables();
    // Apres une coupure (wifi, tunnel...), on revient automatiquement a sa table.
    const table = memoire.lire(CLE_TABLE);
    if (table) await rejoindre(table);
  });

  socket.on("disconnect", (raison) => {
    $("statut").textContent = "deconnecte - reconnexion automatique en cours...";
    journal(`Liaison perdue (${raison}).`);
  });

  socket.on("connect_error", (erreur) => {
    if (erreur.message === "non-authentifie") {
      // Jeton inconnu (serveur redemarre, jeton expire) : retour a l'entree.
      journal("Session expiree : reconnecte-toi.");
      deconnecter();
    } else {
      $("statut").textContent = "serveur injoignable - nouvel essai...";
    }
  });

  // --- Les FAITS diffuses par le serveur ---
  socket.on(EVENEMENTS.TABLES_LISTE, ({ tables }) => remplirTables(tables));

  socket.on(EVENEMENTS.TABLE_PRESENCE, ({ connectes }) => {
    $("liste-presence").replaceChildren(
      ...connectes.map((c) => element("li", `${c.pseudo}${c.role === ROLES.MJ ? " (MJ)" : ""}`)),
    );
  });

  socket.on(EVENEMENTS.PERSONNAGE_MAJ, ({ personnage, cause }) => {
    personnages.set(personnage.id, personnage);
    afficherPersonnages();
    if (cause.action === "creation") {
      journal(`${cause.par} a cree ${personnage.nom}.`);
    } else if (cause.action === "points-de-vie") {
      const pv = personnage.pointsDeVie;
      const absorbes = cause.absorbesParTemporaires ? ` (${cause.absorbesParTemporaires} absorbes par les PV temp.)` : "";
      journal(
        `${cause.par} : ${cause.type} ${cause.montant} sur ${personnage.nom}${absorbes} -> PV ${pv.actuels}/${pv.max}` +
          (cause.aTerre ? " - A TERRE !" : ""),
      );
    }
  });

  socket.on(EVENEMENTS.PERSONNAGE_SUPPRIME, ({ idPersonnage, par }) => {
    const nom = personnages.get(idPersonnage)?.nom ?? "un personnage";
    personnages.delete(idPersonnage);
    afficherPersonnages();
    journal(`${par} a supprime ${nom}.`);
  });

  socket.on(EVENEMENTS.DES_RESULTAT, (r) => {
    const detail = r.termes
      .map((t) =>
        t.type === "des"
          ? `${t.expression}[${t.jets.map((j, i) => (t.gardes.includes(i) ? j : `~${j}~`)).join(",")}]`
          : t.expression,
      )
      .join(" ");
    journal(
      `${r.secret ? "(SECRET) " : ""}${r.par} lance ${r.formule}${r.raison ? ` (${r.raison})` : ""} : ` +
        `${detail} = ${r.total}`,
    );
  });
}

function deconnecter() {
  socket?.disconnect();
  socket = null;
  moi = null;
  memoire.ecrire(CLE_JETON, null);
  memoire.ecrire(CLE_TABLE, null);
  memoire.ecrire("vtt-moi", null);
  $("statut").textContent = "deconnecte";
  personnages.clear();
  afficherZone("connexion");
}

function demarrerSession(jeton, profil) {
  moi = profil;
  memoire.ecrire(CLE_JETON, jeton);
  memoire.ecrire("vtt-moi", JSON.stringify(profil));
  $("moi").textContent = `${profil.pseudo} (${profil.role === ROLES.MJ ? "Maitre du Jeu" : "Joueur"})`;
  afficherElementsMJ();
  afficherZone("tables");
  brancherSocket(jeton);
}

// --- Formulaires ------------------------------------------------------------------------

$("form-connexion").addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const champs = new FormData(evenement.target);
  try {
    const reponse = await fetch("/api/connexion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: champs.get("role"),
        pseudo: champs.get("pseudo"),
        motDePasse: champs.get("motDePasse"),
      }),
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
  const idTable = $("liste-tables").value;
  if (idTable) rejoindre(idTable);
});

$("form-table").addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const nom = new FormData(evenement.target).get("nom");
  const reponse = await demander(EVENEMENTS.TABLE_CREER, { nom });
  if (reponse.ok) {
    evenement.target.reset();
    journal(`Table "${reponse.table.nom}" creee.`);
  }
});

$("form-personnage").addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const champs = new FormData(evenement.target);
  const donnees = {
    nom: champs.get("nom"),
    classe: champs.get("classe"),
    caracteristiques: Object.fromEntries(CARACTERISTIQUES.map((c) => [c, Number(champs.get(c))])),
  };
  const proprietaire = champs.get("proprietaire");
  if (moi?.role === ROLES.MJ && proprietaire) donnees.proprietaire = proprietaire;

  const reponse = await demander(EVENEMENTS.PERSONNAGE_CREER, { donnees });
  if (reponse.ok) evenement.target.elements.nom.value = "";
});

$("form-des").addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const champs = new FormData(evenement.target);
  const demande = { formule: champs.get("formule"), raison: champs.get("raison") || undefined };
  if (moi?.role === ROLES.MJ) demande.secret = champs.get("secret") === "on";
  demander(EVENEMENTS.DES_LANCER, demande);
});

// --- Demarrage de la page --------------------------------------------------------------

$("choix-classe").replaceChildren(
  ...Object.entries(CLASSES).map(([cle, { nom, deDeVie }]) => {
    const option = element("option", `${nom} (d${deDeVie})`);
    option.value = cle;
    return option;
  }),
);

// Rechargement de la page (F5) : on reprend la session de cet onglet.
const jetonMemorise = memoire.lire(CLE_JETON);
const profilMemorise = memoire.lire("vtt-moi");
if (jetonMemorise && profilMemorise) {
  demarrerSession(jetonMemorise, JSON.parse(profilMemorise));
} else {
  afficherZone("connexion");
}
