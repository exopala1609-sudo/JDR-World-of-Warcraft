// Couche temps reel (Socket.IO). Pour l'instant : uniquement la presence.
// Les sorts, deplacements de pions et brouillard viendront s'brancher ici.
import { Server } from "socket.io";
import { EVENEMENTS, ROLES, VERSION_PROTOCOLE } from "../../shared/protocole.js";

export function installerTempsReel(serveurHttp, config) {
  const io = new Server(serveurHttp, {
    cors: { origin: true, credentials: true },
  });

  /** @type {Map<string, {id: string, nom: string, role: string}>} */
  const connectes = new Map();

  const diffuserEtat = () => {
    io.emit(EVENEMENTS.ETAT_SESSION, {
      nomDeLaPartie: config.nomDeLaPartie,
      connectes: [...connectes.values()],
    });
  };

  io.on("connection", (socket) => {
    socket.on(EVENEMENTS.REJOINDRE, (donnees = {}) => {
      const veutEtreMJ = donnees.role === ROLES.MJ;

      if (veutEtreMJ && donnees.motDePasse !== config.motDePasseMJ) {
        socket.emit(EVENEMENTS.ERREUR, { message: "Mot de passe MJ incorrect." });
        return;
      }

      const participant = {
        id: socket.id,
        nom: String(donnees.nom || "Aventurier").slice(0, 32),
        role: veutEtreMJ ? ROLES.MJ : ROLES.JOUEUR,
      };

      connectes.set(socket.id, participant);
      socket.join(participant.role);
      socket.emit(EVENEMENTS.BIENVENUE, { moi: participant, versionProtocole: VERSION_PROTOCOLE });
      console.log(`[temps-reel] ${participant.nom} rejoint (${participant.role}).`);
      diffuserEtat();
    });

    socket.on("disconnect", () => {
      const participant = connectes.get(socket.id);
      if (participant) {
        connectes.delete(socket.id);
        console.log(`[temps-reel] ${participant.nom} s'est deconnecte.`);
        diffuserEtat();
      }
    });
  });

  return io;
}
