// Les outils du MJ poses sur SA barre d'actions (page 1), a la place des
// sorts : un clic, ou la touche 1 a =, comme un raccourci de WoW.
// (Ces boutons ne font qu'OUVRIR des fenetres ou ENVOYER des demandes : le
// serveur refuse tout ce qui vient d'un joueur. Voir docs/ARCHITECTURE.md.)
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, type EtatJeu } from "@/core/jeu";

export type OutilMJ = {
  symbole: string;
  nom: string;
  aide: string;
  action: () => void;
  actif?: (e: EtatJeu) => boolean;
};

const basculer = (nom: keyof EtatJeu["fenetres"]) => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, [nom]: !e.fenetres[nom] } }));
const outilCarte = (outil: "gomme" | "pinceau") => jeu.modifier((e) => ({ outil: e.outil === outil ? "deplacer" : outil }));

// Repos long de toute la table : deux appuis en moins de 4 secondes (pas de clic malheureux).
let confirmationRepos = 0;
function reposLongTable() {
  if (Date.now() - confirmationRepos > 4000) {
    confirmationRepos = Date.now();
    jeu.journaliser("Repos long pour TOUTE la table : appuie encore une fois pour confirmer.");
    return;
  }
  confirmationRepos = 0;
  jeu.demander(EVENEMENTS.REPOS_LONG, {});
}

async function recharger() {
  const r = await jeu.demander(EVENEMENTS.REFERENTIEL_RECHARGER);
  await jeu.demander(EVENEMENTS.COMPENDIUM_RECHARGER);
  if (r.ok) jeu.journaliser("Referentiel recharge (races, classes...).");
}

export const OUTILS_MJ: OutilMJ[] = [
  { symbole: "☠", nom: "Bestiaire", aide: "Monstres et PNJ : les creer, les glisser sur la carte.", action: () => basculer("bestiaire"), actif: (e) => e.fenetres.bestiaire },
  { symbole: "✦", nom: "Compendium", aide: "Donner objets, sorts, auras ; remplir un coffre.", action: () => basculer("compendium"), actif: (e) => e.fenetres.compendium },
  { symbole: "⚔", nom: "Initiative", aide: "Lancer et mener le combat (aussi : touche I).", action: () => basculer("initiative"), actif: (e) => e.fenetres.initiative },
  { symbole: "⌖", nom: "Carte", aide: "Image de fond, grille, brouillard.", action: () => basculer("carteMJ"), actif: (e) => e.fenetres.carteMJ },
  { symbole: "☀", nom: "Reveler (gomme)", aide: "Effacer le brouillard sur la carte.", action: () => outilCarte("gomme"), actif: (e) => e.outil === "gomme" },
  { symbole: "☁", nom: "Cacher (pinceau)", aide: "Repeindre le brouillard sur la carte.", action: () => outilCarte("pinceau"), actif: (e) => e.outil === "pinceau" },
  { symbole: "!", nom: "Journal de quetes", aide: "Donner une quete au groupe (aussi : touche L).", action: () => basculer("quetes"), actif: (e) => e.fenetres.quetes },
  { symbole: "☾", nom: "Repos long (table)", aide: "Repos long pour toute la table. Deux appuis pour confirmer.", action: reposLongTable },
  { symbole: "✎", nom: "Carnet du MJ", aide: "Tes notes privees (aussi : touche N).", action: () => basculer("carnet"), actif: (e) => e.fenetres.carnet },
  { symbole: "↻", nom: "Recharger", aide: "Relire les fichiers du compendium et du referentiel apres modification.", action: recharger },
];
