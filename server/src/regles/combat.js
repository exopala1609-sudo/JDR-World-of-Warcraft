// Combat : initiative et tours de jeu (D&D 5e).
//
// - Initiative = 1d20 + modificateur de Dexterite, lance par le serveur.
// - Ordre : initiative la plus haute d'abord. En cas d'egalite, la meilleure
//   Dexterite passe devant ; si l'egalite persiste, un tirage au sort (fait une
//   fois pour toutes au debut) tranche, pour que l'ordre ne change plus.
// - Quand le dernier a joue, on revient au premier et le round augmente.
import { randomInt } from "node:crypto";
import { modificateur } from "../../../shared/dnd5e.js";
import { nouvelId } from "../modeles/identifiants.js";
import { lancerDes } from "./des.js";
import { ErreurRegle } from "./erreurs.js";

export function lancerInitiative(personnage, lancer = lancerDes) {
  const jet = lancer("1d20").total;
  const bonus = modificateur(personnage.caracteristiques.dexterite);
  return {
    id: nouvelId("c"),
    idPersonnage: personnage.id,
    nom: personnage.nom,
    jet,
    bonus,
    initiative: jet + bonus,
    dexterite: personnage.caracteristiques.dexterite,
    departage: randomInt(0, 1_000_001),
  };
}

const ordre = (a, b) => b.initiative - a.initiative || b.dexterite - a.dexterite || b.departage - a.departage;

/** Re-trie en gardant le meme participant actif (utile en plein combat). */
function retrier(combat, participants) {
  const actif = combat.participants[combat.indexActif]?.id;
  const tries = [...participants].sort(ordre);
  const indexActif = Math.max(0, tries.findIndex((p) => p.id === actif));
  return { ...combat, participants: tries, indexActif };
}

export function creerCombat(idTable, participants) {
  if (participants.length === 0) throw new ErreurRegle("Il faut au moins un combattant.");
  return {
    idTable,
    round: 1,
    indexActif: 0,
    participants: [...participants].sort(ordre),
    demarreLe: new Date().toISOString(),
  };
}

/** Passe au suivant. Renvoie aussi qui vient de finir son tour. */
export function tourSuivant(combat) {
  const finDeTour = combat.participants[combat.indexActif];
  const dernier = combat.indexActif === combat.participants.length - 1;
  return {
    combat: {
      ...combat,
      indexActif: dernier ? 0 : combat.indexActif + 1,
      round: dernier ? combat.round + 1 : combat.round,
    },
    finDeTour,
    nouveauRound: dernier,
  };
}

export function tourPrecedent(combat) {
  if (combat.indexActif === 0 && combat.round === 1) throw new ErreurRegle("C'est deja le tout premier tour.");
  const premier = combat.indexActif === 0;
  return {
    ...combat,
    indexActif: premier ? combat.participants.length - 1 : combat.indexActif - 1,
    round: premier ? combat.round - 1 : combat.round,
  };
}

export function ajouterParticipant(combat, participant) {
  if (combat.participants.some((p) => p.idPersonnage === participant.idPersonnage)) {
    throw new ErreurRegle(`${participant.nom} participe deja au combat.`);
  }
  return retrier(combat, [...combat.participants, participant]);
}

/** Retire un combattant. Renvoie null s'il n'en reste plus aucun. */
export function retirerParticipant(combat, idParticipant) {
  const index = combat.participants.findIndex((p) => p.id === idParticipant);
  if (index === -1) throw new ErreurRegle("Ce combattant n'est pas dans le combat.");
  const participants = combat.participants.filter((p) => p.id !== idParticipant);
  if (participants.length === 0) return null;

  let indexActif = combat.indexActif;
  if (index < indexActif) indexActif -= 1; // quelqu'un avant l'actif part : on decale
  if (indexActif >= participants.length) indexActif = 0; // l'actif etait le dernier
  return { ...combat, participants, indexActif };
}

/** Le MJ impose une valeur (ex. un joueur a lance son propre de). */
export function fixerInitiative(combat, idParticipant, valeur) {
  if (!Number.isInteger(valeur) || valeur < -20 || valeur > 60) throw new ErreurRegle("Initiative invalide.");
  if (!combat.participants.some((p) => p.id === idParticipant)) {
    throw new ErreurRegle("Ce combattant n'est pas dans le combat.");
  }
  const participants = combat.participants.map((p) => (p.id === idParticipant ? { ...p, initiative: valeur } : p));
  return retrier(combat, participants);
}
