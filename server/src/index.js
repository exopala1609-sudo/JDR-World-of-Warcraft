// Point d'entree : le serveur tourne sur le PC du MJ (fixe ou portable).
// Il sert l'interface aux navigateurs ET maintient la partie en temps reel.
import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { CATEGORIES_PUBLIQUES, chargerConfig, RACINE } from "./config.js";
import { afficherDiagnostic, diagnostiquerDossiers } from "./diagnostic.js";
import { afficherBanniere } from "./reseau.js";
import { installerTempsReel } from "./temps-reel.js";
import { poserVerrou } from "./verrou.js";
import { VERSION_PROTOCOLE } from "../../shared/protocole.js";

const config = chargerConfig();
const modeDev = process.argv.includes("--dev");
const rapportDossiers = diagnostiquerDossiers(config);
const app = express();
const serveurHttp = createServer(app);

app.disable("x-powered-by");

// --- API minimale : le client demande "a qui je parle ?" avant de se connecter.
app.get("/api/session", (_requete, reponse) => {
  reponse.json({
    nomDeLaPartie: config.nomDeLaPartie,
    nomDuPoste: config.nomDuPoste,
    versionProtocole: VERSION_PROTOCOLE,
  });
});

// --- Etat des dossiers, pour l'afficher plus tard dans l'ecran du MJ.
app.get("/api/diagnostic", (_requete, reponse) => {
  reponse.json({
    racineAssets: config.racineAssets,
    cloud: config.cloud,
    dossiers: rapportDossiers.map(({ categorie, etat, nbFichiers }) => ({
      categorie,
      etat,
      nbFichiers,
    })),
  });
});

// --- Medias locaux : les gros fichiers sont lus directement sur le disque
//     (ou le dossier cloud synchronise), en streaming, sans aucun upload.
for (const categorie of CATEGORIES_PUBLIQUES) {
  app.use(
    `/medias/${categorie}`,
    express.static(config.dossiers[categorie], { maxAge: "1h", fallthrough: true, dotfiles: "ignore" }),
  );
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
        "<p style='font-family:sans-serif'>Interface non compilee. " +
          "En developpement, ouvre <a href='http://localhost:5173'>http://localhost:5173</a>, " +
          "ou lance <code>npm run build</code> puis <code>npm start</code>.</p>",
      );
  });
}

installerTempsReel(serveurHttp, config);

serveurHttp.listen(config.port, "0.0.0.0", () => {
  afficherBanniere(config, { modeDev });
  afficherDiagnostic(config, rapportDossiers);
  try {
    mkdirSync(config.dossiers.parties, { recursive: true });
    poserVerrou(config);
  } catch (erreur) {
    console.warn(`[verrou] Dossier de sauvegardes inaccessible : ${erreur.message}`);
  }
});
