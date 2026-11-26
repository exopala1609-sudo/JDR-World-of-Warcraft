// Revenir a une copie de secours des parties.
//
//   npm run restaurer           liste les copies (la 1 est la plus recente)
//   npm run restaurer -- 3      remet les tables dans l'etat de la copie n°3
//
// Le serveur doit etre ARRETE : sinon il reecrirait aussitot par-dessus.
// Avant de restaurer, une copie de l'etat actuel est prise ("avant-restauration") :
// si tu t'es trompe de numero, tu peux revenir en arriere de la meme facon.
import { resolve } from "node:path";
import { chargerConfig, RACINE } from "../server/src/config.js";
import { creerCopie, listerCopies, restaurerCopie } from "../server/src/donnees/sauvegardes.js";
import { partieEnCours } from "../server/src/verrou.js";

const config = chargerConfig();
if (config.problemes.length) {
  console.error("\n  !! Le fichier .env de ce poste est a corriger :");
  for (const probleme of config.problemes) console.error(`     - ${probleme}`);
  console.error(`     Fichier : ${resolve(RACINE, ".env")}\n`);
  process.exit(1);
}

const { parties, sauvegardes } = config.dossiers;
const copies = listerCopies(sauvegardes);
const choix = process.argv[2];

if (!choix) {
  console.log(`\n  Copies de secours (${sauvegardes}) :\n`);
  if (copies.length === 0) console.log("    Aucune copie pour l'instant : elles sont prises au demarrage du serveur.");
  copies.forEach((c, i) => {
    console.log(`    ${String(i + 1).padStart(2)}.  ${c.libelle}   ${c.raison.padEnd(20)} ${c.tables} table(s)`);
  });
  console.log("\n  Pour revenir a une copie : arrete le serveur, puis tape par exemple");
  console.log("    npm run restaurer -- 3\n");
  process.exit(0);
}

const numero = Number(choix);
const copie = Number.isInteger(numero) && numero >= 1 ? copies[numero - 1] : copies.find((c) => c.nom === choix);
if (!copie) {
  console.error(`\n  !! Copie "${choix}" introuvable. Tape "npm run restaurer" pour voir la liste.\n`);
  process.exit(1);
}

const enCours = partieEnCours(parties);
if (enCours) {
  console.error(`\n  !! Une partie tourne encore (sur "${enCours.poste}"). Arrete d'abord le serveur`);
  console.error("     (Ctrl + C dans sa fenetre), attends une minute, puis relance cette commande.\n");
  process.exit(1);
}

// Une copie de l'etat actuel, gardee quoi qu'il arrive (pas de menage) : la
// copie qu'on va restaurer ne peut donc pas etre supprimee entre-temps.
const filet = creerCopie(parties, sauvegardes, "avant-restauration", { garder: Infinity });
const nombre = restaurerCopie(parties, copie.chemin);
console.log(`\n  Restauration terminee : ${nombre} table(s) remises dans l'etat du ${copie.libelle}.`);
if (filet) console.log(`  L'etat d'avant est garde dans la copie "${filet}" (n°1 de la liste).`);
console.log("  Tu peux relancer la partie.\n");
