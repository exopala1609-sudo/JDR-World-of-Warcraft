// Point d'entree du serveur : le "chef d'orchestre".
// Il ne contient presque aucune logique ; il branche les pieces ensemble,
// dans cet ordre : configuration -> donnees -> acces -> pages -> temps reel.
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { exigerMJ, routesAcces } from "./auth/routes.js";
import { creerGestionnaireSessions } from "./auth/sessions.js";
import { CATEGORIES_PUBLIQUES, chargerConfig, RACINE } from "./config.js";
import { afficherDiagnostic, creerSousDossiersManquants, diagnostiquerDossiers } from "./diagnostic.js";
import { creerDepot } from "./donnees/depot.js";
import { afficherBanniere, afficherLienDistant } from "./reseau.js";
import { installerTempsReel } from "./temps-reel.js";
import { copierDansPressePapiers, ouvrirTunnel } from "./tunnel.js";
import { poserVerrou } from "./verrou.js";
import { VERSION_PROTOCOLE } from "../../shared/protocole.js";

// --- 1. Configuration du poste (.env) ---------------------------------------
const config = chargerConfig();
const modeDev = process.argv.includes("--dev");
const avecTunnel = process.argv.includes("--tunnel"); // npm run partie
const dossiersCrees = creerSousDossiersManquants(config);
const rapportDossiers = diagnostiquerDossiers(config);

// --- 2. Donnees : lecture des tables et fiches depuis le dossier cloud -------
// Si le dossier racine est introuvable, on n'ecrit rien nulle part : mieux vaut
// un serveur qui refuse de demarrer qu'une partie sauvegardee au mauvais endroit.
if (!rapportDossiers.find((d) => d.categorie === "parties" && ["ok", "vide"].includes(d.etat))) {
  console.error(`\n  !! Dossier de sauvegarde introuvable : ${config.dossiers.parties}`);
  console.error("     Verifie VTT_ASSETS dans le fichier .env, ou lance : npm run detecter-assets\n");
  process.exit(1);
}
const depot = creerDepot(config.dossiers.parties);
const bilan = depot.charger();

// --- 3. Acces -----------------------------------------------------------------
const sessions = creerGestionnaireSessions(config);

// --- 4. Serveur web -------------------------------------------------------------
const app = express();
const serveurHttp = createServer(app);

app.disable("x-powered-by");
// Un tunnel (ngrok, cloudflared) se connecte depuis ce PC et transmet la vraie
// adresse du joueur dans un en-tete : on ne fait confiance qu'a lui.
app.set("trust proxy", "loopback");
app.use((_requete, reponse, suite) => {
  reponse.set("X-Content-Type-Options", "nosniff");
  reponse.set("Referrer-Policy", "no-referrer");
  suite();
});

app.use(routesAcces(sessions));

app.get("/api/session", (_requete, reponse) => {
  reponse.json({ nomDeLaPartie: config.nomDeLaPartie, versionProtocole: VERSION_PROTOCOLE });
});

// Revele des chemins de ton disque : reserve au MJ.
app.get("/api/diagnostic", exigerMJ(sessions), (_requete, reponse) => {
  reponse.json({ racineAssets: config.racineAssets, cloud: config.cloud, dossiers: rapportDossiers });
});

// Page de test brute du sprint 1 (HTML + JS, aucune compilation necessaire).
app.use("/test", express.static(resolve(RACINE, "server", "public", "test")));
// Vocabulaire et regles partages, lisibles par les navigateurs.
app.use("/partage", express.static(resolve(RACINE, "shared")));

// Medias : servis directement depuis le dossier (cloud) du MJ, sans upload.
for (const categorie of CATEGORIES_PUBLIQUES) {
  app.use(
    `/medias/${categorie}`,
    express.static(config.dossiers[categorie], { maxAge: "1h", dotfiles: "ignore" }),
  );
}

// Interface principale (client compile), sinon un message d'orientation.
const CLIENT_COMPILE = resolve(RACINE, "client", "dist");
if (existsSync(CLIENT_COMPILE)) {
  app.use(express.static(CLIENT_COMPILE));
  app.get("*", (_requete, reponse) => reponse.sendFile(resolve(CLIENT_COMPILE, "index.html")));
} else {
  app.get("*", (_requete, reponse) => {
    reponse
      .type("html")
      .send("<p>Interface non compilee. Page de test du sprint 1 : <a href='/test/'>/test/</a></p>");
  });
}

// --- 5. Temps reel ---------------------------------------------------------------
installerTempsReel(serveurHttp, { depot, sessions });

// --- 6. Demarrage ------------------------------------------------------------------
let libererVerrou = () => {};
let fermerTunnel = () => {};

// Page d'arrivee des joueurs. Sprint 1 : le banc de test.
const CHEMIN_JOUEURS = "/test/";

serveurHttp.listen(config.port, "0.0.0.0", () => {
  afficherBanniere(config, { modeDev });
  if (dossiersCrees.length) console.log(`  Sous-dossiers crees : ${dossiersCrees.join(", ")}`);
  afficherDiagnostic(config, rapportDossiers);
  console.log(`  Donnees chargees : ${bilan.tables} table(s), ${bilan.personnages} personnage(s).`);
  if (bilan.ignores) console.log(`  !! ${bilan.ignores} fichier(s) invalide(s) ignore(s), voir ci-dessus.`);
  if (!sessions.motDePasseUtilisable) {
    console.log("  !! Acces MJ DESACTIVE : definis VTT_MOTDEPASSE_MJ (6 caracteres min.) dans .env.");
  }
  console.log("");
  libererVerrou = poserVerrou(config);

  if (avecTunnel) {
    ouvrirTunnel(config.port)
      .then(({ adresse, fermer }) => {
        fermerTunnel = fermer;
        const lien = `${adresse}${CHEMIN_JOUEURS}`;
        afficherLienDistant(lien, { copie: copierDansPressePapiers(lien) });
      })
      .catch((erreur) => {
        console.warn(`\n  !! Acces distant impossible : ${erreur.message}.`);
        console.warn("     La partie reste jouable sur ton reseau local. Verifie ta connexion Internet,");
        console.warn("     puis relance : npm run partie\n");
      });
  }
});

serveurHttp.on("error", (erreur) => {
  if (erreur.code === "EADDRINUSE") {
    console.error(`\n  !! Le port ${config.port} est deja utilise : le serveur tourne-t-il deja dans une autre fenetre ?\n`);
    process.exit(1);
  }
  throw erreur;
});

// --- 7. Arret propre (Ctrl + C) : rien ne doit se perdre ----------------------------
function arreter() {
  console.log("\n  Arret : sauvegarde des donnees en attente...");
  depot.vider();
  fermerTunnel();
  libererVerrou();
  process.exit(0);
}
process.once("SIGINT", arreter);
process.once("SIGTERM", arreter);
