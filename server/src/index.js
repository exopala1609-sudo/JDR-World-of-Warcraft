// Point d'entree du serveur : le "chef d'orchestre".
// Il ne contient presque aucune logique ; il branche les pieces ensemble,
// dans cet ordre : configuration -> donnees -> acces -> pages -> temps reel.
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { exigerMJ, routesAcces } from "./auth/routes.js";
import { creerGestionnaireSessions } from "./auth/sessions.js";
import { anciennesPartiesLocales, chargerConfig, RACINE } from "./config.js";
import { afficherDiagnostic, afficherDiagnosticIcones, creerSousDossiersManquants, diagnostiquerDossiers, installerLisezMoi } from "./diagnostic.js";
import { bibliothequeIcones } from "./donnees/bibliotheque-icones.js";
import { creerCompendium, installerExemples, installerFichierExemple } from "./donnees/compendium.js";
import { creerDepot } from "./donnees/depot.js";
import { creerReferentiel, installerExemplesReferentiel, resumerReferentiel, situerErreur } from "./donnees/referentiel.js";
import { routesMedias } from "./medias.js";
import { routesTeleversement } from "./televersement.js";
import { afficherBanniere, afficherLienDistant } from "./reseau.js";
import { installerTempsReel } from "./temps-reel/index.js";
import { copierDansPressePapiers, ouvrirTunnel } from "./tunnel.js";
import { poserVerrou } from "./verrou.js";
import { VERSION_PROTOCOLE } from "../../shared/protocole.js";

// --- 1. Configuration du poste (.env) ---------------------------------------
const config = chargerConfig();
// Pas de dossier cloud valide : on refuse de demarrer. Surtout pas de "dossier
// de secours" dans le projet : une partie y serait invisible depuis l'autre PC.
if (config.problemes.length) {
  console.error("\n  !! Le serveur ne demarre pas : le fichier .env de ce PC est a corriger.\n");
  for (const probleme of config.problemes) console.error(`     - ${probleme}`);
  console.error(`\n     Fichier a ouvrir : ${resolve(RACINE, ".env")}`);
  console.error("     Pour trouver le bon chemin : npm run detecter-assets");
  console.error("     Exemple (Google Drive) :    VTT_ASSETS=G:\\Mon Drive\\JDR\n");
  process.exit(1);
}
const modeDev = process.argv.includes("--dev");
const avecTunnel = process.argv.includes("--tunnel"); // npm run partie
const dossiersCrees = creerSousDossiersManquants(config);
installerLisezMoi(config, resolve(RACINE, "exemples"));
// Compendium vide (premier lancement) : on y depose les fichiers d'exemple.
const exemplesInstalles = installerExemples(config.dossiers.compendium, resolve(RACINE, "exemples", "compendium"));
// Referentiel vide (premier lancement) : races, classes... provisoires, a remplacer.
const referentielInstalle = installerExemplesReferentiel(
  config.dossiers.referentiel,
  resolve(RACINE, "exemples", "referentiel"),
);
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

// Compendium : lecture de tous les fichiers JSON du dossier.
const compendium = creerCompendium(config.dossiers.compendium);
let rapportCompendium = compendium.charger();
// Mise a jour : un compendium deja rempli, mais sans aucun monstre -> on y
// ajoute le bestiaire d'exemple (sans toucher aux autres fichiers).
let bestiaireInstalle = false;
if (rapportCompendium.monstres === 0) {
  bestiaireInstalle = installerFichierExemple(config.dossiers.compendium, resolve(RACINE, "exemples", "compendium", "exemple-bestiaire.json"));
  if (bestiaireInstalle) rapportCompendium = compendium.charger();
}

// Referentiel : factions, races, classes et regles de creation de personnage.
const referentiel = creerReferentiel(config.dossiers.referentiel);
const rapportReferentiel = referentiel.charger();

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
// MJ : televerser une image de carte (ecrite dans cartes/ du cloud).
app.use(routesTeleversement(config, sessions));

app.get("/api/session", (_requete, reponse) => {
  reponse.json({ nomDeLaPartie: config.nomDeLaPartie, versionProtocole: VERSION_PROTOCOLE });
});

// Revele des chemins de ton disque : reserve au MJ.
app.get("/api/diagnostic", exigerMJ(sessions), (_requete, reponse) => {
  reponse.json({ racineAssets: config.racineAssets, cloud: config.cloud, dossiers: rapportDossiers });
});

// L'ancienne page de test blanche (/test/) n'existe plus : TOUT le monde, MJ
// compris, passe par l'interface World of Warcraft. Un ancien lien y mene.
app.get(["/test", "/test/*"], (_requete, reponse) => reponse.redirect(301, "/"));

// Medias : servis directement depuis le dossier (cloud) du MJ, sans upload,
// avec une image de remplacement grise pour tout fichier encore absent.
app.use(routesMedias(config));

// Une adresse d'API inconnue : une vraie erreur, pas la page du jeu.
app.use("/api", (_requete, reponse) => reponse.status(404).json({ erreur: "Adresse inconnue." }));

// POINT D'ENTREE UNIQUE : http://localhost:3000/ (et toute autre adresse)
// renvoie l'interface World of Warcraft, qui s'ouvre sur l'ecran de connexion.
// Joueurs et MJ y entrent par la meme porte ; seul le role change.
const CLIENT_COMPILE = resolve(RACINE, "client", "dist");
app.get("*", (requete, reponse, suite) => {
  if (existsSync(resolve(CLIENT_COMPILE, "index.html"))) return suite();
  // Developpement (npm run dev) : l'interface est servie par Vite, port 5173.
  if (modeDev) return reponse.redirect(`${requete.protocol}://${requete.hostname}:5173${requete.originalUrl}`);
  reponse.status(503).type("html").send(pageNonCompilee());
});
app.use(express.static(CLIENT_COMPILE));
app.get("*", (_requete, reponse) => reponse.sendFile(resolve(CLIENT_COMPILE, "index.html")));

// --- 5. Temps reel ---------------------------------------------------------------
installerTempsReel(serveurHttp, { depot, sessions, compendium, referentiel, config });

// --- 6. Demarrage ------------------------------------------------------------------
let libererVerrou = () => {};
let fermerTunnel = () => {};

// Page d'arrivee de TOUS (joueurs et MJ) : l'interface World of Warcraft.
const CHEMIN_JOUEURS = "/";

serveurHttp.listen(config.port, "0.0.0.0", async () => {
  afficherBanniere(config, { modeDev });
  if (dossiersCrees.length) console.log(`  Sous-dossiers crees : ${dossiersCrees.join(", ")}`);
  afficherDiagnostic(config, rapportDossiers);
  // Les icones (souvent un dossier a part : VTT_ASSETS_ICONES) : ce que le jeu y trouve.
  await afficherDiagnosticIcones(config, bibliothequeIcones(config.dossiers.icones));
  // La ligne la plus importante pour jouer sur deux PC : OU sont les sauvegardes.
  console.log(`  Sauvegardes      : ${config.dossiers.parties}${config.cloud ? `  (${config.cloud})` : ""}`);
  console.log(`  Donnees chargees : ${bilan.tables} table(s), ${bilan.personnages} personnage(s).`);
  if (!config.cloud) {
    console.log("  !! Ce dossier n'est pas reconnu comme un dossier cloud (OneDrive, Google Drive...).");
    console.log("     Les parties sauvegardees ici ne seront PAS visibles depuis ton autre PC.");
  }
  if (bilan.tables === 0) {
    console.log("  !! Aucune table dans ce dossier. Si tu as joue sur ton autre PC, verifie que");
    console.log("     VTT_ASSETS pointe vers le MEME dossier cloud et que la synchronisation est terminee.");
  }
  const anciennes = anciennesPartiesLocales();
  if (anciennes.tables.length) {
    console.log(`  !! ${anciennes.tables.length} ancienne(s) table(s) trouvee(s) DANS le projet : ${anciennes.dossier}`);
    console.log("     (sauvegardees avant que VTT_ASSETS ne soit obligatoire). Pour les garder, copie");
    console.log(`     leurs dossiers t-xxxxxxxxxx dans ${config.dossiers.parties}, puis relance.`);
  }
  if (bilan.combats) console.log(`  Combat(s) en cours repris : ${bilan.combats}.`);
  if (bilan.migrees) console.log(`  Fiches mises au nouveau format : ${bilan.migrees}.`);
  if (bilan.ignores) console.log(`  !! ${bilan.ignores} fichier(s) invalide(s) ignore(s), voir ci-dessus.`);
  if (exemplesInstalles.length) console.log(`  Compendium vide : exemples installes (${exemplesInstalles.join(", ")}).`);
  console.log(
    `  Compendium : ${rapportCompendium.objets} objet(s), ${rapportCompendium.sorts} sort(s), ` +
      `${rapportCompendium.etats} aura(s) personnalisee(s), ${rapportCompendium.monstres} monstre(s).`,
  );
  if (bestiaireInstalle) console.log("  Bestiaire d'exemple ajoute au compendium : exemple-bestiaire.json.");
  for (const { fichier, emplacement, message } of rapportCompendium.erreurs) {
    console.log(`  !! compendium/${fichier} > ${emplacement} : ${message}`);
  }
  if (referentielInstalle.length) console.log(`  Referentiel vide : exemples installes (${referentielInstalle.join(", ")}).`);
  console.log(`  Referentiel : ${resumerReferentiel(rapportReferentiel)}.`);
  for (const erreur of rapportReferentiel.erreurs) console.log(`  !! ${situerErreur(erreur)} : ${erreur.message}`);
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

/** Interface pas encore compilee : une page sombre qui dit quoi faire (pas une page blanche). */
function pageNonCompilee() {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>VTT</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e11;color:#c8c8c8;font-family:Georgia,serif">
<div style="padding:32px 40px;border:2px solid #c9a441;border-radius:8px;background:#17171b;max-width:560px">
<h1 style="margin:0 0 12px;color:#ffd100;font-weight:normal">L'interface n'est pas encore prete</h1>
<p>Arrete le serveur (Ctrl + C), puis lance :</p>
<pre style="color:#fff;background:#000;padding:10px 14px;border-radius:4px">npm run partie</pre>
<p>Cette commande prepare l'interface World of Warcraft, puis demarre la partie.</p></div></body></html>`;
}

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
