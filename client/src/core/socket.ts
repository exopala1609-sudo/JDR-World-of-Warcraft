import { io, type Socket } from "socket.io-client";

// En developpement Vite fait suivre /socket.io vers le serveur du MJ,
// en production le serveur sert lui-meme la page : la meme origine suffit.
export const socket: Socket = io({
  autoConnect: true,
  transports: ["websocket", "polling"],
});
