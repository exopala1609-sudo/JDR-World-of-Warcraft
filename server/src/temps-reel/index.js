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
//   table:<id>:joueur:<pseudo>  les ecrans d'UN joueur (son sac, prive)
//   mj              tous les ecrans MJ, quelle que soit la table (compendium)
//
// Ce fichier prepare les outils communs ; chaque domaine du jeu a son fichier :
//   tables.js, personnages.js, repos.js, referentiel.js, compendium.js,
//   combat.js, scene.js, tactique.js (traces et pings), des.js
import { Server } from "socket.io";
import { z } from "zod";
import { EVENEMENTS, ROLES } from "../../../shared/protocole.js";
import { normaliserPseudo } from "../auth/sessions.js";
import { bibliothequeIcones } from "../donnees/bibliotheque-icones.js";
import { presenterPersonnage, santeVisible } from "../modeles/personnage.js";
import { butinVisibleParLesJoueurs } from "../regles/butins.js";
import { pionVisibleParLesJoueurs } from "../regles/scene.js";
import { ErreurRegle } from "../regles/erreurs.js";
import * as combat from "./combat.js";
import * as compendium from "./compendium.js";
import * as bestiaire from "./bestiaire.js";
import * as butins from "./butins.js";
import * as chat from "./chat.js";
import * as des from "./des.js";
import * as equipement from "./equipement.js";
import * as joueurs from "./joueurs.js";
import * as notes from "./notes.js";
import * as personnages from "./personnages.js";
import * as quetes from "./quetes.js";
import * as referentiel from "./referentiel.js";
import * as repos from "./repos.js";
import * as resolution from "./resolution.js";
import * as scene from "./scene.js";
import * as sons from "./sons.js";
import * as tables from "./tables.js";
import * as tactique from "./tactique.js";

const DOMAINES = [tables, personnages, repos, referentiel, compendium, equipement, butins, resolution, quetes, combat, scene, tactique, des, chat, sons, joueurs, bestiaire, notes];

export const SALLE_MJ = "mj";
export const salleTable = (idTable) => `table:${idTable}`;
export const salleMJ = (idTable) => `table:${idTable}:mj`;
export const salleJoueurs = (idTable) => `table:${idTable}:joueurs`;
export const salleDuJoueur = (idTable, pseudo) => `table:${idTable}:joueur:${normaliserPseudo(pseudo)}`;

/**
 * Ce que les AUTRES joueurs voient d'un heros : tout (caracteristiques, PV,
 * etats...), sauf le contenu de son sac, comme l'"Inspecter" de WoW. Le sac
 * n'est envoye qu'a son proprietaire et au MJ.
 */
const vuePublique = (fiche) => ({ ...fiche, inventaire: [], sacPrive: true });

/**
 * L'image dessinee dans le pion (adresse sous /medias/, sans le prefixe) :
 * son jeton (dossier jetons/), sinon son portrait, sinon portraits/<nom>.
 * Absente du dossier : le pion garde ses initiales.
 */
export function imageDuPion(personnage) {
  if (!personnage) return null;
  // "icones/xxx" : une icone choisie dans le selecteur sert d'image au pion.
  if (personnage.jeton) return personnage.jeton.startsWith("icones/") ? personnage.jeton : `jetons/${personnage.jeton}`;
  if (personnage.portrait) return `portraits/${personnage.portrait}`;
  if (!personnage.proprietaire) return null;
  const nom = personnage.nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return nom ? `portraits/${nom}` : null;
}

export function installerTempsReel(serveurHttp, { depot, sessions, compendium: bibliotheque, referentiel: regles, config }) {
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
    referentiel: regles,
    config,

    // Traces tactiques de chaque table (idTable -> liste). Gardees en MEMOIRE
    // seulement : ce sont des annotations ephemeres, pas une sauvegarde.
    traces: new Map(),

    // Jets de la fenetre de resolution, en attente de "Valider" (idJet -> jet).
    jets: new Map(),

    sessions,
    // Les noms des icones du dossier icones/ (selecteur d'icones), lus a la demande.
    icones: bibliothequeIcones(config?.dossiers?.icones),
    // Joueurs expulses par le MJ, par table (pseudos normalises). En memoire.
    expulsesParTable: new Map(),
    expulses(idTable) {
      if (!ctx.expulsesParTable.has(idTable)) ctx.expulsesParTable.set(idTable, new Set());
      return ctx.expulsesParTable.get(idTable);
    },

    /**
     * Anti-inondation : true tant que ce navigateur n'a pas fait cette action
     * plus de "maxParSeconde" fois dans la seconde en cours. Protege la table
     * d'un joueur qui enverrait 1000 pings par seconde avec un script, sans
     * gener un usage normal (qui reste loin en dessous).
     */
    quota(socket, action, maxParSeconde) {
      const compteurs = (socket.data.quotas ??= {});
      const seconde = Math.floor(Date.now() / 1000);
      const compteur = compteurs[action]?.seconde === seconde ? compteurs[action] : { seconde, nombre: 0 };
      compteur.nombre += 1;
      compteurs[action] = compteur;
      return compteur.nombre <= maxParSeconde;
    },

    estMJ: (socket) => socket.data.profil.role === ROLES.MJ,

    exigerMJ(socket, action) {
      if (!ctx.estMJ(socket)) throw new ErreurRegle(`Seul le MJ peut ${action}.`);
    },

    /** Le personnage de ce joueur a cette table (un seul par joueur et par table). */
    personnageDuJoueur(socket, idTable) {
      return depot.personnagesDeLaTable(idTable).find((p) => ctx.estProprietaire(socket, p)) ?? null;
    },

    /** Quitte les salons de la table courante (ou la porte de l'ecran de creation). */
    async quitterTable(socket) {
      const ancienne = socket.data.idTable;
      socket.data.idTable = null;
      socket.data.idTableCreation = null;
      if (!ancienne) return;
      socket.leave(salleTable(ancienne));
      socket.leave(salleMJ(ancienne));
      socket.leave(salleJoueurs(ancienne));
      socket.leave(salleDuJoueur(ancienne, socket.data.profil.pseudo));
      await ctx.diffuserPresence(ancienne);
    },

    /**
     * Fait entrer ce navigateur dans une table : il rejoint ses salons (il
     * recevra desormais tout ce qui s'y passe) et recoit une photo complete
     * de ce qu'il a le droit de voir.
     */
    async entrerDansLaTable(socket, idTable) {
      socket.data.idTable = idTable;
      socket.data.idTableCreation = null;
      socket.join(salleTable(idTable));
      if (ctx.estMJ(socket)) socket.join(salleMJ(idTable));
      else socket.join([salleJoueurs(idTable), salleDuJoueur(idTable, socket.data.profil.pseudo)]);
      await ctx.diffuserPresence(idTable);
      return {
        table: depot.obtenirTable(idTable),
        creationRequise: false,
        personnages: ctx.personnagesVisibles(socket, idTable),
        combat: ctx.estMJ(socket) ? depot.obtenirCombat(idTable) : ctx.combatPourJoueurs(depot.obtenirCombat(idTable)),
        scene: ctx.vueDeLaScene(depot.obtenirScene(idTable), ctx.estMJ(socket)),
        traces: ctx.traces.get(idTable) ?? [],
        quetes: depot.obtenirQuetes(idTable),
      };
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
        .map((p) => {
          const presente = presenterPersonnage(p);
          return ctx.estMJ(socket) || ctx.estProprietaire(socket, p) ? presente : vuePublique(presente);
        });
    },

    /**
     * Enregistre une fiche modifiee et l'annonce a qui de droit :
     *  - un PNJ : au MJ seul ;
     *  - un heros : la fiche complete au MJ et a son proprietaire, la
     *    fiche sans le contenu du sac aux autres joueurs.
     */
    publierPersonnage(personnage, cause) {
      const avant = depot.obtenirPersonnage(personnage.id);
      const enregistre = depot.enregistrerPersonnage(personnage);
      const presente = presenterPersonnage(enregistre);
      const { idTable, proprietaire } = enregistre;
      if (proprietaire === null) {
        io.to(salleMJ(idTable)).emit(EVENEMENTS.PERSONNAGE_MAJ, { personnage: presente, cause });
        // Un monstre visible a change de nom, de niveau, de rang ou de sante
        // (a 10 % pres) : les joueurs recoivent la scene a jour (cadre de cible).
        const apparence = (p) => p && `${p.nom}|${p.niveau}|${p.rang}|${santeVisible(p)}`;
        if (apparence(avant) !== apparence(enregistre) && ctx.pnjVisible(enregistre)) {
          ctx.envoyerSceneAuxJoueurs(idTable, depot.obtenirScene(idTable));
        }
        return presente;
      }
      const sallePrivee = salleDuJoueur(idTable, proprietaire);
      io.to(salleMJ(idTable)).to(sallePrivee).emit(EVENEMENTS.PERSONNAGE_MAJ, { personnage: presente, cause });
      io.to(salleJoueurs(idTable)).except(sallePrivee).emit(EVENEMENTS.PERSONNAGE_MAJ, { personnage: vuePublique(presente), cause });
      return presente;
    },

    /**
     * Texte de combat flottant (degats, soins) au-dessus du pion.
     * Le MJ le voit toujours. Les joueurs le voient pour un personnage-joueur,
     * et pour un monstre SEULEMENT si son pion leur est visible : un monstre
     * tapi dans le brouillard ne se trahit pas par ses chiffres de degats.
     */
    publierTexteCombat(personnage, texte) {
      if (!texte) return;
      const message = { idPersonnage: personnage.id, ...texte };
      io.to(salleMJ(personnage.idTable)).emit(EVENEMENTS.COMBAT_TEXTE, message);
      const scene = depot.obtenirScene(personnage.idTable);
      const pion = scene.pions.find((p) => p.idPersonnage === personnage.id);
      if (personnage.proprietaire !== null || (pion && pionVisibleParLesJoueurs(scene, pion, personnage))) {
        io.to(salleJoueurs(personnage.idTable)).emit(EVENEMENTS.COMBAT_TEXTE, message);
      }
    },

    /**
     * Un PNJ / monstre est-il connu des joueurs ? Seulement si son pion est sur
     * la carte ET visible (ni cache par le MJ, ni dans le brouillard).
     */
    pnjVisible(personnage) {
      if (!personnage) return false;
      if (personnage.proprietaire !== null) return true;
      const scene = depot.obtenirScene(personnage.idTable);
      const pion = scene.pions.find((p) => p.idPersonnage === personnage.id);
      return Boolean(pion && pionVisibleParLesJoueurs(scene, pion, personnage));
    },

    /**
     * Le combat tel que les joueurs ont le droit de le voir : un monstre cache
     * garde sa place dans l'ordre (sinon les tours seraient decales), mais
     * devient anonyme : ni nom, ni identifiant, ni jet. "Au tour de ???".
     */
    combatPourJoueurs(combat) {
      if (!combat) return combat;
      return {
        ...combat,
        participants: combat.participants.map((p) =>
          ctx.pnjVisible(depot.obtenirPersonnage(p.idPersonnage))
            ? p
            : { id: p.id, idPersonnage: null, nom: "???", masque: true, jet: null, bonus: null, initiative: null },
        ),
      };
    },

    publierCombat(idTable, cause) {
      const combat = depot.obtenirCombat(idTable);
      io.to(salleMJ(idTable)).emit(EVENEMENTS.COMBAT_ETAT, { combat, cause });
      if (!cause) return io.to(salleJoueurs(idTable)).emit(EVENEMENTS.COMBAT_ETAT, { combat: ctx.combatPourJoueurs(combat), cause: null });
      io.to(salleJoueurs(idTable)).emit(EVENEMENTS.COMBAT_ETAT, { combat: ctx.combatPourJoueurs(combat), cause: ctx.causePourJoueurs(idTable, cause) });
    },

    /**
     * La "cause" d'un message, filtree pour les joueurs : les noms des monstres
     * qu'ils ne voient pas deviennent "???" et leurs jets d'initiative
     * disparaissent. (Tous les PNJ invisibles de la table, meme ceux qui ne
     * sont plus au combat : un monstre retire ne doit pas se trahir non plus.)
     */
    causePourJoueurs(idTable, cause) {
      if (!cause) return cause;
      const caches = new Set(depot.personnagesDeLaTable(idTable).filter((p) => !ctx.pnjVisible(p)).map((p) => p.nom));
      const anonyme = (nom) => (caches.has(nom) ? "???" : nom);
      return {
        ...cause,
        ...(cause.jets && { jets: cause.jets.filter((j) => !caches.has(j.nom)) }),
        ...(cause.actif && { actif: anonyme(cause.actif) }),
        ...(cause.finDeTour && { finDeTour: anonyme(cause.finDeTour) }),
        ...(cause.nom && { nom: anonyme(cause.nom) }),
      };
    },

    /**
     * Envoie aux joueurs la scene qu'ils ont le droit de voir. Un monstre a pu
     * apparaitre ou disparaitre : l'ordre du combat (anonymise) suit.
     */
    envoyerSceneAuxJoueurs(idTable, scene, cause) {
      io.to(salleJoueurs(idTable)).emit(EVENEMENTS.SCENE_ETAT, { scene: ctx.vueDeLaScene(scene, false), cause: ctx.causePourJoueurs(idTable, cause) });
      if (depot.obtenirCombat(idTable)) ctx.publierCombat(idTable, null);
    },

    /**
     * Un pion, complete du nom et du proprietaire de son personnage. Pour un
     * monstre, aussi ce qu'en montre le cadre de cible des joueurs (qui n'ont
     * pas sa fiche) : niveau, rang et sante arrondie a 10 %.
     */
    presenterPion(pion) {
      const personnage = depot.obtenirPersonnage(pion.idPersonnage);
      const pion2 = { ...pion, nom: personnage?.nom ?? "?", proprietaire: personnage?.proprietaire ?? null, image: imageDuPion(personnage) };
      if (!personnage || personnage.proprietaire !== null) return pion2;
      return { ...pion2, niveau: personnage.niveau, rang: personnage.rang ?? "normal", sante: santeVisible(personnage) };
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
      // Butins : le MJ voit tout ; un joueur ne voit que ceux hors du brouillard,
      // et jamais leur contenu (seulement s'ils sont vides) : il faut ouvrir.
      const butins = pourMJ
        ? scene.butins
        : scene.butins
            .filter((b) => butinVisibleParLesJoueurs(scene, b))
            .map(({ objets, cache: _cache, ...b }) => ({ ...b, vide: objets.length === 0 }));
      return { ...scene, pions: pions.map((p) => ctx.presenterPion(p)), butins };
    },

    publierScene(idTable, cause) {
      const scene = depot.obtenirScene(idTable);
      io.to(salleMJ(idTable)).emit(EVENEMENTS.SCENE_ETAT, { scene: ctx.vueDeLaScene(scene, true), cause });
      ctx.envoyerSceneAuxJoueurs(idTable, scene, cause);
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
