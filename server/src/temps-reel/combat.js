// Domaine "combat" : initiative, tours, et expiration des etats.
//
// Protection "double clic" : pour passer au tour suivant, le navigateur doit
// dire QUI il croit etre le combattant actif (idActif). Si le MJ et le joueur
// cliquent en meme temps, la premiere demande fait avancer le tour ; la
// seconde arrive avec un idActif perime et est refusee. Sans cela, deux clics
// simultanes feraient sauter le tour du combattant suivant.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { schemaId } from "../modeles/identifiants.js";
import { z } from "../modeles/zod.js";
import {
  ajouterParticipant,
  creerCombat,
  deplacerParticipant,
  fixerInitiative,
  lancerInitiative,
  retirerParticipant,
  tourPrecedent,
  tourSuivant,
} from "../regles/combat.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { ecoulerUnRound } from "../regles/etats.js";
import { jouerSon } from "./sons.js";

const Demandes = {
  demarrer: z.strictObject({ idsPersonnages: z.array(schemaId("p")).min(1).max(60).optional() }),
  suivant: z.strictObject({ idActif: schemaId("c") }),
  ajouter: z.strictObject({ idPersonnage: schemaId("p") }),
  retirer: z.strictObject({ idParticipant: schemaId("c") }),
  fixer: z.strictObject({ idParticipant: schemaId("c"), valeur: z.int().min(-20).max(60) }),
  deplacer: z.strictObject({ idParticipant: schemaId("c"), sens: z.literal([-1, 1]) }),
};

const resumeJet = (p) => ({ nom: p.nom, jet: p.jet, bonus: p.bonus, initiative: p.initiative });

export function brancher(socket, ctx) {
  const { depot } = ctx;
  const pseudo = socket.data.profil.pseudo;

  function exigerCombat() {
    const idTable = ctx.exigerTable(socket);
    const combat = depot.obtenirCombat(idTable);
    if (!combat) throw new ErreurRegle("Aucun combat en cours.");
    return combat;
  }

  function enregistrerEtPublier(combat, cause) {
    depot.enregistrerCombat(combat);
    ctx.publierCombat(combat.idTable, cause);
    return { combat: depot.obtenirCombat(combat.idTable) };
  }

  ctx.guichet(socket, EVENEMENTS.COMBAT_DEMARRER, Demandes.demarrer, ({ idsPersonnages }) => {
    ctx.exigerMJ(socket, "lancer un combat");
    const idTable = ctx.exigerTable(socket);
    if (depot.obtenirCombat(idTable)) throw new ErreurRegle("Un combat est deja en cours sur cette table.");

    // Par defaut : tous les personnages de la table (joueurs et PNJ).
    const combattants = idsPersonnages
      ? idsPersonnages.map((id) => ctx.exigerPersonnageVisible(socket, id))
      : depot.personnagesDeLaTable(idTable);
    if (combattants.length === 0) throw new ErreurRegle("Aucun personnage a faire combattre.");

    const combat = creerCombat(idTable, combattants.map((p) => lancerInitiative(p)));
    // Au combat, plus personne n'est "repose".
    for (const p of combattants) if (p.repose) ctx.publierPersonnage({ ...p, repose: false }, { action: "combat", par: pseudo });
    jouerSon(ctx, idTable, "combat"); // tambours de guerre : le jet d'initiative est tombe
    return enregistrerEtPublier(combat, { action: "debut", par: pseudo, jets: combat.participants.map(resumeJet) });
  });

  ctx.guichet(socket, EVENEMENTS.COMBAT_TOUR_SUIVANT, Demandes.suivant, ({ idActif }) => {
    const combat = exigerCombat();
    const actif = combat.participants[combat.indexActif];
    if (actif.id !== idActif) throw new ErreurRegle("Le tour a deja change.");

    // Le MJ fait avancer n'importe quel tour ; un joueur ne termine que le sien.
    const personnageActif = depot.obtenirPersonnage(actif.idPersonnage);
    if (!ctx.estMJ(socket) && !(personnageActif && ctx.estProprietaire(socket, personnageActif))) {
      throw new ErreurRegle("Ce n'est pas ton tour.");
    }

    const { combat: suite, finDeTour, nouveauRound } = tourSuivant(combat);

    // Fin du tour : les etats a duree de ce combattant perdent un round.
    if (personnageActif) {
      const { personnage, expires, change } = ecoulerUnRound(personnageActif);
      if (change) ctx.publierPersonnage(personnage, { action: "etats-ecoules", nom: personnage.nom, expires });
    }

    const nouvelActif = suite.participants[suite.indexActif];
    return enregistrerEtPublier(suite, {
      action: "tour",
      par: pseudo,
      finDeTour: finDeTour.nom,
      actif: nouvelActif.nom,
      round: suite.round,
      nouveauRound,
    });
  });

  ctx.guichet(socket, EVENEMENTS.COMBAT_TOUR_PRECEDENT, null, () => {
    ctx.exigerMJ(socket, "revenir au tour precedent");
    const suite = tourPrecedent(exigerCombat());
    return enregistrerEtPublier(suite, {
      action: "retour",
      par: pseudo,
      actif: suite.participants[suite.indexActif].nom,
      round: suite.round,
    });
  });

  ctx.guichet(socket, EVENEMENTS.COMBAT_AJOUTER, Demandes.ajouter, ({ idPersonnage }) => {
    ctx.exigerMJ(socket, "ajouter un combattant");
    const combat = exigerCombat();
    const participant = lancerInitiative(ctx.exigerPersonnageVisible(socket, idPersonnage));
    return enregistrerEtPublier(ajouterParticipant(combat, participant), {
      action: "arrivee",
      par: pseudo,
      jets: [resumeJet(participant)],
    });
  });

  ctx.guichet(socket, EVENEMENTS.COMBAT_RETIRER, Demandes.retirer, ({ idParticipant }) => {
    ctx.exigerMJ(socket, "retirer un combattant");
    const combat = exigerCombat();
    const nom = combat.participants.find((p) => p.id === idParticipant)?.nom;
    const suite = retirerParticipant(combat, idParticipant);
    if (!suite) {
      depot.supprimerCombat(combat.idTable);
      ctx.publierCombat(combat.idTable, { action: "fin", par: pseudo, rounds: combat.round });
      return { combat: null };
    }
    return enregistrerEtPublier(suite, { action: "retrait", par: pseudo, nom });
  });

  ctx.guichet(socket, EVENEMENTS.COMBAT_DEPLACER, Demandes.deplacer, ({ idParticipant, sens }) => {
    ctx.exigerMJ(socket, "changer l'ordre des tours");
    const combat = exigerCombat();
    const nom = combat.participants.find((p) => p.id === idParticipant)?.nom;
    return enregistrerEtPublier(deplacerParticipant(combat, idParticipant, sens), { action: "ordre", par: pseudo, nom });
  });

  ctx.guichet(socket, EVENEMENTS.COMBAT_FIXER_INITIATIVE, Demandes.fixer, ({ idParticipant, valeur }) => {
    ctx.exigerMJ(socket, "modifier une initiative");
    const combat = exigerCombat();
    const nom = combat.participants.find((p) => p.id === idParticipant)?.nom;
    return enregistrerEtPublier(fixerInitiative(combat, idParticipant, valeur), {
      action: "initiative-fixee",
      par: pseudo,
      nom,
      valeur,
    });
  });

  ctx.guichet(socket, EVENEMENTS.COMBAT_TERMINER, null, () => {
    ctx.exigerMJ(socket, "terminer le combat");
    const combat = exigerCombat();
    depot.supprimerCombat(combat.idTable);
    ctx.publierCombat(combat.idTable, { action: "fin", par: pseudo, rounds: combat.round });
    return { combat: null };
  });
}
