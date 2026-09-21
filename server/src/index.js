// Point d'entree : le serveur tourne sur le PC du MJ.
// Il sert l'interface aux navigateurs ET maintient la partie en temps reel.
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { chargerConfig, RACINE } from "./config.js";
import { afficherBanniere } from "./reseau.js";
import { installerTempsReel } from "./temps-reel.js";
import { VERSION_PROTOCOLE } from "../../shared/protocole.js";

const config = chargerConfig();
const app = express();
const serveurHttp = createServer(app);

app.disable("x-powered-by");

// --- API minimale : le client demande "a qui je parle ?" avant de se connecter.
app.get("/api/session", (_requete, reponse) => {
  reponse.json({
    nomDeLaPartie: config.nomDeLaPartie,
    versionProtocole: VERSION_PROTOCOLE,
  });
});

// --- Medias locaux : les gros fichiers du MJ sont servis depuis son disque,
//     en streaming, sans aucun upload. (Dossiers definis dans config.json.)
for (const [nom, chemin] of Object.entries(config.dossiers)) {
  app.use(`/medias/${nom}`, express.static(chemin, { maxAge: "1h", fallthrough: true }));
}

// --- Interface : en production on sert le client compile.
const CLIENT_COMPILE = resolve(RACINE, "client", "dist");
if (existsSync(CLIENT_COMPILE)) {
  app.use(express.static(CLIENT_COMPILE));
  app.get("*", (_requete, reponse) => {
    reponse.sendFile(resolve(CLIENT_COMPILE, "index.html"));
  });
} else {
  app.get("*", (_requete, reponse) => {
    reponse
      .status(200)
      .type("html")
      .send(
        "<p style='font-family:sans-serif'>Client non compile. " +
          "En developpement, ouvre <a href='http://localhost:5173'>http://localhost:5173</a>.</p>",
      );
  });
}

installerTempsReel(serveurHttp, config);

serveurHttp.listen(config.port, "0.0.0.0", () => {
  afficherBanniere(config);
});
