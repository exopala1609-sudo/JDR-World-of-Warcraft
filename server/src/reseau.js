// Petites aides reseau : trouver l'adresse du PC du MJ sur le reseau local.
import { networkInterfaces } from "node:os";

export function adressesLocales() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((carte) => carte && carte.family === "IPv4" && !carte.internal)
    .map((carte) => carte.address);
}

export function afficherBanniere({ port, nomDeLaPartie, nomDuPoste }) {
  const lignes = [
    "",
    "  ============================================================",
    `   VTT  -  ${nomDeLaPartie}   (poste : ${nomDuPoste})`,
    "  ============================================================",
    `   Ecran du MJ    : http://localhost:${port}/mj`,
    `   Lien joueurs   : http://localhost:${port}/`,
  ];

  for (const ip of adressesLocales()) {
    lignes.push(`   Reseau local   : http://${ip}:${port}/`);
  }

  lignes.push(
    "",
    "   Pour des joueurs hors de ton reseau : voir docs/ACCES-JOUEURS.md",
    "  ============================================================",
    "",
  );

  console.log(lignes.join("\n"));
}
