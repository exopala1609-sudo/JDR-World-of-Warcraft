// Moteur temps reel (Socket.IO) : le "tuyau" toujours ouvert entre le PC du
// MJ et chaque navigateur.
//
// REGLE D'OR - le serveur est l'unique arbitre :
//   Un navigateur n'annonce jamais "j'ai fait 17" ou "il reste 8 PV".
//   Il DEMANDE ("lance 1d20+5", "inflige 7 degats a Thrall"). Le serveur
//   verifie les droits, applique les regles, enregistre, puis DIFFUSE le
//   resultat. Tout le monde recoit donc exactement la meme verite.
//
// SALONS (rooms) - a qui envoyer quoi :
//   table:<id>          tous les participants d'une table (MJ + joueurs)
//   table:<id>:mj       le MJ seul (lancers secrets, fiches de PNJ)
import { Server } from "socket.io";
import { z } from "zod";
import { EVENEMENTS, ROLES, TYPES_PV } from "../../shared/protocole.js";
import { normaliserPseudo } from "./auth/sessions.js";
import { schemaId } from "./modeles/identifiants.js";
import { fabriquerPersonnage, presenterPersonnage } from "./modeles/personnage.js";
import { fabriquerTable } from "./modeles/table.js";
import { lancerDes } from "./regles/des.js";
import { ErreurRegle } from "./regles/erreurs.js";
import { appliquerPointsDeVie } from "./regles/points-de-vie.js";

const salleTable = (idTable) => `table:${idTable}`;
const salleMJ = (idTable) => `table:${idTable}:mj`;

// Forme attendue de chaque demande. Tout champ inattendu est refuse.
const Demandes = {
  rejoindre: z.strictObject({ idTable: schemaId("t") }),
  creerPersonnage: z.strictObject({ donnees: z.unknown() }),
  cibler: z.strictObject({ idPersonnage: schemaId("p") }),
  modifierPv: z.strictObject({
    idPersonnage: schemaId("p"),
    type: z.enum(Object.values(TYPES_PV)),
    montant: z.int().min(0).max(10_000),
  }),
  lancerDes: z.strictObject({
    formule: z.string().max(60),
    raison: z.string().trim().max(80).optional(),
    secret: z.boolean().optional(),
  }),
};

export function installerTempsReel(serveurHttp, { depot, sessions }) {
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

  // --- Outils de diffusion ------------------------------------------------

  // Une fiche de joueur est visible de toute la table ; un PNJ, du MJ seul.
  const salleDuPersonnage = (p) => (p.proprietaire ? salleTable(p.idTable) : salleMJ(p.idTable));

  const estMJ = (socket) => socket.data.profil.role === ROLES.MJ;

  function peutModifier(socket, personnage) {
    return estMJ(socket) || normaliserPseudo(personnage.proprietaire) === normaliserPseudo(socket.data.profil.pseudo);
  }

  function personnagesVisibles(socket, idTable) {
    return depot
      .personnagesDeLaTable(idTable)
      .filter((p) => estMJ(socket) || p.proprietaire !== null)
      .map(presenterPersonnage);
  }

  async function diffuserPresence(idTable) {
    const sockets = await io.in(salleTable(idTable)).fetchSockets();
    const connectes = sockets.map((s) => ({ pseudo: s.data.profil.pseudo, role: s.data.profil.role }));
    io.to(salleTable(idTable)).emit(EVENEMENTS.TABLE_PRESENCE, { connectes });
  }

  function exigerTable(socket) {
    const idTable = socket.data.idTable;
    if (!idTable || !depot.obtenirTable(idTable)) throw new ErreurRegle("Rejoins d'abord une table.");
    return idTable;
  }

  function exigerPersonnageModifiable(socket, idPersonnage) {
    const idTable = exigerTable(socket);
    const personnage = depot.obtenirPersonnage(idPersonnage);
    // Meme message si la fiche n'existe pas ou n'est pas visible : un joueur
    // ne peut pas deviner l'existence d'un PNJ cache en tatonnant.
    if (!personnage || personnage.idTable !== idTable || (!estMJ(socket) && personnage.proprietaire === null)) {
      throw new ErreurRegle("Personnage introuvable.");
    }
    if (!peutModifier(socket, personnage)) throw new ErreurRegle("Ce personnage ne t'appartient pas.");
    return personnage;
  }

  // --- 2. Chaque demande passe par ce guichet unique. ----------------------
  // Il valide la forme, execute la regle, puis repond a l'envoyeur par un
  // "accuse de reception" (ack) : { ok: true, ... } ou { ok: false, erreur }.
  function guichet(socket, evenement, schema, traitement) {
    socket.on(evenement, async (donnees, accuse) => {
      const repondre = typeof accuse === "function" ? accuse : () => {};
      try {
        const demande = schema ? schema.parse(donnees ?? {}) : donnees;
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
  }

  // --- 3. Les demandes possibles --------------------------------------------
  io.on("connection", (socket) => {
    const { pseudo, role } = socket.data.profil;
    console.log(`[temps-reel] ${pseudo} (${role}) est en ligne.`);

    guichet(socket, EVENEMENTS.TABLES_LISTER, null, () => ({ tables: depot.listerTables() }));

    guichet(socket, EVENEMENTS.TABLE_CREER, null, (donnees) => {
      if (!estMJ(socket)) throw new ErreurRegle("Seul le MJ peut creer une table.");
      const table = depot.enregistrerTable(fabriquerTable(donnees ?? {}));
      io.emit(EVENEMENTS.TABLES_LISTE, { tables: depot.listerTables() });
      console.log(`[temps-reel] Table creee : ${table.nom} (${table.id}).`);
      return { table };
    });

    guichet(socket, EVENEMENTS.TABLE_REJOINDRE, Demandes.rejoindre, async ({ idTable }) => {
      const table = depot.obtenirTable(idTable);
      if (!table) throw new ErreurRegle("Table introuvable.");

      // On quitte l'eventuelle table precedente avant d'entrer dans la nouvelle.
      const ancienne = socket.data.idTable;
      if (ancienne && ancienne !== idTable) {
        socket.leave(salleTable(ancienne));
        socket.leave(salleMJ(ancienne));
        await diffuserPresence(ancienne);
      }

      socket.data.idTable = idTable;
      socket.join(salleTable(idTable));
      if (estMJ(socket)) socket.join(salleMJ(idTable));
      await diffuserPresence(idTable);

      // L'arrivant recoit une photo complete de la table (ce qu'il a le droit de voir).
      return { table, personnages: personnagesVisibles(socket, idTable) };
    });

    guichet(socket, EVENEMENTS.PERSONNAGE_CREER, Demandes.creerPersonnage, ({ donnees }) => {
      const idTable = exigerTable(socket);
      const demande = { ...(donnees ?? {}) };

      // Un joueur cree toujours SA fiche ; le MJ choisit le proprietaire (ou PNJ).
      let proprietaire;
      if (estMJ(socket)) {
        // La forme exacte (texte de 2 a 24 caracteres) est verifiee par le schema.
        proprietaire = typeof demande.proprietaire === "string" ? demande.proprietaire.trim() || null : null;
      } else {
        if (demande.proprietaire !== undefined) throw new ErreurRegle("Seul le MJ peut attribuer une fiche.");
        proprietaire = pseudo;
      }

      const personnage = depot.enregistrerPersonnage(fabriquerPersonnage(demande, { idTable, proprietaire }));
      io.to(salleDuPersonnage(personnage)).emit(EVENEMENTS.PERSONNAGE_MAJ, {
        personnage: presenterPersonnage(personnage),
        cause: { action: "creation", par: pseudo },
      });
      return { personnage: presenterPersonnage(personnage) };
    });

    guichet(socket, EVENEMENTS.PERSONNAGE_SUPPRIMER, Demandes.cibler, ({ idPersonnage }) => {
      const personnage = exigerPersonnageModifiable(socket, idPersonnage);
      depot.supprimerPersonnage(personnage.id);
      io.to(salleDuPersonnage(personnage)).emit(EVENEMENTS.PERSONNAGE_SUPPRIME, {
        idPersonnage: personnage.id,
        par: pseudo,
      });
      return {};
    });

    guichet(socket, EVENEMENTS.PERSONNAGE_MODIFIER_PV, Demandes.modifierPv, ({ idPersonnage, type, montant }) => {
      const personnage = exigerPersonnageModifiable(socket, idPersonnage);
      const { pointsDeVie, detail } = appliquerPointsDeVie(personnage.pointsDeVie, type, montant);
      const misAJour = depot.enregistrerPersonnage({ ...personnage, pointsDeVie });

      io.to(salleDuPersonnage(misAJour)).emit(EVENEMENTS.PERSONNAGE_MAJ, {
        personnage: presenterPersonnage(misAJour),
        cause: { action: "points-de-vie", par: pseudo, ...detail },
      });
      return { personnage: presenterPersonnage(misAJour) };
    });

    guichet(socket, EVENEMENTS.DES_LANCER, Demandes.lancerDes, ({ formule, raison, secret }) => {
      const idTable = exigerTable(socket);
      if (secret && !estMJ(socket)) throw new ErreurRegle("Seul le MJ peut lancer en secret.");

      const resultat = {
        ...lancerDes(formule),
        raison: raison || null,
        par: pseudo,
        secret: Boolean(secret),
        horodatage: new Date().toISOString(),
      };
      io.to(secret ? salleMJ(idTable) : salleTable(idTable)).emit(EVENEMENTS.DES_RESULTAT, resultat);
      return { resultat };
    });

    socket.on("disconnect", () => {
      console.log(`[temps-reel] ${pseudo} (${role}) s'est deconnecte.`);
      if (socket.data.idTable) diffuserPresence(socket.data.idTable).catch(() => {});
    });
  });

  return io;
}
