// Petites aides reseau : trouver l'adresse du PC du MJ sur le reseau local.
import { networkInterfaces } from "node:os";

export function adressesLocales() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((carte) => carte && carte.family === "IPv4" && !carte.internal)
    .map((carte) => carte.address);
}

// En developpement, l'interface est servie par Vite (port 5173) et non par le
// serveur de jeu : le bandeau doit donner l'adresse que l'on ouvre vraiment.
export const PORT_VITE = 5173;

export function afficherBanniere({ port, nomDeLaPartie, nomDuPoste }, { modeDev = false } = {}) {
  const portInterface = modeDev ? PORT_VITE : port;
  const lignes = [
    "",
    "  ============================================================",
    `   VTT  -  ${nomDeLaPartie}   (poste : ${nomDuPoste})`,
    modeDev ? "   Mode developpement" : "   Mode partie",
    "  ============================================================",
    `   Interface de jeu (WoW) : http://localhost:${portInterface}/`,
  ];

  for (const ip of adressesLocales()) {
    lignes.push(`   Lien joueurs (reseau)  : http://${ip}:${portInterface}/`);
  }

  lignes.push("", `   Outils du MJ           : http://localhost:${portInterface}/test/`);

  lignes.push(
    "",
    "   Pour des joueurs hors de ton reseau : voir docs/ACCES-JOUEURS.md",
    "  ============================================================",
    "",
  );

  console.log(lignes.join("\n"));
}

/** Encadre bien visible avec le lien a coller dans Discord. */
export function afficherLienDistant(lien, { copie }) {
  const lignes = [
    "",
    "  ************************************************************",
    "   LIEN A ENVOYER A TES JOUEURS :",
    "",
    `     ${lien}`,
    "",
    copie
      ? "   Deja copie ! Colle-le dans Discord avec Ctrl + V."
      : "   Selectionne-le a la souris, puis Clic droit > Copier.",
    "   Ce lien change a chaque partie et cesse de fonctionner",
    "   des que tu fermes cette fenetre.",
    "  ************************************************************",
    "",
  ];
  console.log(lignes.join("\n"));
}
