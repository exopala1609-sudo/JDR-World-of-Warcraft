// Moteur temps reel (Socket.IO) : le "tuyau" toujours ouvert entre le PC du
// MJ et chaque navigateur.
//
// REGLE D'OR - le serveur est l'unique arbitre :
//   Un navigateur n'annonce jamais un resultat. Il DEMANDE ("repos long",
//   "lance l'initiative"). Le serveur verifie les droits, applique les regles,
//   enregistre, puis DIFFUSE le resultat : tout le monde recoit la meme verite.
//
// SALONS (rooms) - a qui envoyer quoi :
//   table:<id>      tous les participants d'une table (MJ + joueurs)
//   table:<id>:mj   le MJ de cette table (PNJ caches, lancers secrets)
//   table:<id>:joueurs  les joueurs seuls (ce qu'ils voient de la carte)
//   mj              tous les ecrans MJ, quelle que soit la table (compendium)
//
// Ce fichier prepare les outils communs ; chaque domaine du jeu a son fichier :
//   tables.js, personnages.js, repos.js, compendium.js, combat.js, des.js
import { Server } from "socket.io";
import { z } from "zod";
import { EVENEMENTS, ROLES } from "../../../shared/protocole.js";
import { normaliserPseudo } from "../auth/sessions.js";
import { presenterPersonnage } from "../modeles/personnage.js";
import { pionVisibleParLesJoueurs } from "../regles/scene.js";
import { ErreurRegle } from "../regles/erreurs.js";
import * as combat from "./combat.js";
import * as compendium from "./compendium.js";
import * as des from "./des.js";
import * as personnages from "./personnages.js";
import * as repos from "./repos.js";
import * as scene from "./scene.js";
import * as tables from "./tables.js";

const DOMAINES = [tables, personnages, repos, compendium, combat, scene, des];

export const SALLE_MJ = "mj";
export const salleTable = (idTable) => `table:${idTable}`;
export const salleMJ = (idTable) => `table:${idTable}:mj`;
export const salleJoueurs = (idTable) => `table:${idTable}:joueurs`;

export function installerTempsReel(serveurHttp, { depot, sessions, compendium: bibliotheque, config }) {
  const io = new Server(serveurHttp, {
    // Aucun message legitime ne depasse quelques Ko : on refuse les colis geants.
    maxHttpBufferSize: 100_000,
  });

  // --- 1. Controle a l'entree : pas de jeton valide, pas de connexion. -----
  io.use((socket, suite) => {
    const profil = sessions.verifier(socket.handshake.auth?.jeton);
    if (!profil) return suite(new Error("non-authentifie"));
    socket.data.profil = profil;
    suite();
  });

  // --- 2. La "boite a outils" partagee par tous les domaines ---------------
  const ctx = {
    io,
    depot,
    compendium: bibliotheque,
    config,

    estMJ: (socket) => socket.data.profil.role === ROLES.MJ,

    exigerMJ(socket, action) {
      if (!ctx.estMJ(socket)) throw new ErreurRegle(`Seul le MJ peut ${action}.`);
    },

    exigerTable(socket) {
      const idTable = socket.data.idTable;
      if (!idTable || !depot.obtenirTable(idTable)) throw new ErreurRegle("Rejoins d'abord une table.");
      return idTable;
    },

    /** Le personnage existe, est a cette table, et ce navigateur a le droit de le voir. */
    exigerPersonnageVisible(socket, idPersonnage) {
      const idTable = ctx.exigerTable(socket);
      const personnage = depot.obtenirPersonnage(idPersonnage);
      // Meme message si la fiche n'existe pas ou est cachee : un joueur ne peut
      // pas deviner l'existence d'un PNJ en tatonnant.
      if (!personnage || personnage.idTable !== idTable || (!ctx.estMJ(socket) && personnage.proprietaire === null)) {
        throw new ErreurRegle("Personnage introuvable.");
      }
      return personnage;
    },

    /** ... et en plus, il a le droit de le modifier (le MJ, ou son proprietaire). */
    exigerPersonnageModifiable(socket, idPersonnage) {
      const personnage = ctx.exigerPersonnageVisible(socket, idPersonnage);
      if (!ctx.estMJ(socket) && !ctx.estProprietaire(socket, personnage)) {
        throw new ErreurRegle("Ce personnage ne t'appartient pas.");
      }
      return personnage;
    },

    estProprietaire: (socket, personnage) =>
      personnage.proprietaire !== null &&
      normaliserPseudo(personnage.proprietaire) === normaliserPseudo(socket.data.profil.pseudo),

    // Une fiche de joueur est visible de toute la table ; un PNJ, du MJ seul.
    salleDuPersonnage: (p) => (p.proprietaire ? salleTable(p.idTable) : salleMJ(p.idTable)),

    personnagesVisibles(socket, idTable) {
      return depot
        .personnagesDeLaTable(idTable)
        .filter((p) => ctx.estMJ(socket) || p.proprietaire !== null)
        .map(presenterPersonnage);
    },

    /** Enregistre une fiche modifiee et l'annonce a qui de droit. */
    publierPersonnage(personnage, cause) {
      const enregistre = depot.enregistrerPersonnage(personnage);
      const presente = presenterPersonnage(enregistre);
      io.to(ctx.salleDuPersonnage(enregistre)).emit(EVENEMENTS.PERSONNAGE_MAJ, { personnage: presente, cause });
      return presente;
    },

    publierCombat(idTable, cause) {
      io.to(salleTable(idTable)).emit(EVENEMENTS.COMBAT_ETAT, { combat: depot.obtenirCombat(idTable), cause });
    },

    /** Un pion, complete du nom et du proprietaire de son personnage. */
    presenterPion(pion) {
      const personnage = depot.obtenirPersonnage(pion.idPersonnage);
      return { ...pion, nom: personnage?.nom ?? "?", proprietaire: personnage?.proprietaire ?? null };
    },

    /**
     * La scene telle qu'un role a le droit de la voir. Le MJ voit tout ;
     * les joueurs ne recoivent PAS les pions caches ni les monstres tapis
     * dans le brouillard : ces pions ne quittent jamais le serveur.
     */
    vueDeLaScene(scene, pourMJ) {
      const pions = pourMJ
        ? scene.pions
        : scene.pions.filter((p) => pionVisibleParLesJoueurs(scene, p, depot.obtenirPersonnage(p.idPersonnage)));
      return { ...scene, pions: pions.map((p) => ctx.presenterPion(p)) };
    },

    publierScene(idTable, cause) {
      const scene = depot.obtenirScene(idTable);
      io.to(salleMJ(idTable)).emit(EVENEMENTS.SCENE_ETAT, { scene: ctx.vueDeLaScene(scene, true), cause });
      io.to(salleJoueurs(idTable)).emit(EVENEMENTS.SCENE_ETAT, { scene: ctx.vueDeLaScene(scene, false), cause });
    },

    async diffuserPresence(idTable) {
      const sockets = await io.in(salleTable(idTable)).fetchSockets();
      const connectes = sockets.map((s) => ({ pseudo: s.data.profil.pseudo, role: s.data.profil.role }));
      io.to(salleTable(idTable)).emit(EVENEMENTS.TABLE_PRESENCE, { connectes });
    },

    /**
     * Le guichet unique : chaque demande y passe. Il valide la forme (Zod),
     * execute la regle, puis repond a l'envoyeur par un "accuse de reception" :
     * { ok: true, ... } ou { ok: false, erreur: "raison lisible" }.
     */
    guichet(socket, evenement, schema, traitement) {
      socket.on(evenement, async (donnees, accuse) => {
        const repondre = typeof accuse === "function" ? accuse : () => {};
        try {
          const demande = schema ? schema.parse(donnees ?? {}) : (donnees ?? {});
          repondre({ ok: true, ...(await traitement(demande)) });
        } catch (erreur) {
          if (erreur instanceof ErreurRegle) {
            repondre({ ok: false, erreur: erreur.message });
          } else if (erreur instanceof z.ZodError) {
            const message = erreur.issues
              .map((i) => (i.path.length ? `${i.path.join(".")} : ${i.message}` : i.message))
              .join(" ; ");
            repondre({ ok: false, erreur: `Demande invalide - ${message}` });
          } else {
            console.error(`[temps-reel] Erreur inattendue sur "${evenement}" :`, erreur);
            repondre({ ok: false, erreur: "Erreur interne du serveur." });
          }
        }
      });
    },
  };

  // --- 3. Chaque connexion recoit les guichets de tous les domaines --------
  io.on("connection", (socket) => {
    const { pseudo, role } = socket.data.profil;
    console.log(`[temps-reel] ${pseudo} (${role}) est en ligne.`);
    if (ctx.estMJ(socket)) socket.join(SALLE_MJ);

    for (const domaine of DOMAINES) domaine.brancher(socket, ctx);

    socket.on("disconnect", () => {
      console.log(`[temps-reel] ${pseudo} (${role}) s'est deconnecte.`);
      if (socket.data.idTable) ctx.diffuserPresence(socket.data.idTable).catch(() => {});
    });
  });

  return io;
}
