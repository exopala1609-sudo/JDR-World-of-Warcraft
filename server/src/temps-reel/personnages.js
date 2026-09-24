// Domaine "personnages" : creation, points de vie, ressources et etats.
import { EVENEMENTS, TYPES_PV } from "../../../shared/protocole.js";
import { MODELES_RESSOURCES } from "../../../shared/ressources.js";
import { schemaId } from "../modeles/identifiants.js";
import { fabriquerPersonnage } from "../modeles/personnage.js";
import { z } from "../modeles/zod.js";
import { retirerParticipant } from "../regles/combat.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { poserEtat, retirerEtat } from "../regles/etats.js";
import { appliquerPointsDeVie } from "../regles/points-de-vie.js";
import { modifierRessource } from "../regles/ressources.js";

const idPersonnage = schemaId("p");
const cleRessource = z.string().regex(/^[a-z0-9-]{1,40}$/);

const Demandes = {
  creer: z.strictObject({ donnees: z.unknown() }),
  cibler: z.strictObject({ idPersonnage }),
  modifierPv: z.strictObject({
    idPersonnage,
    type: z.enum(Object.values(TYPES_PV)),
    montant: z.int().min(0).max(10_000),
  }),
  modifierRessource: z.strictObject({ idPersonnage, cle: cleRessource, variation: z.int().min(-999).max(999) }),
  ajouterRessource: z.strictObject({
    idPersonnage,
    modele: z.enum(Object.keys(MODELES_RESSOURCES)),
    max: z.int().min(1).max(999).optional(),
  }),
  retirerRessource: z.strictObject({ idPersonnage, cle: cleRessource }),
  poserEtat: z.strictObject({
    idPersonnage,
    cle: z.string().regex(/^[a-z0-9-]{1,60}$/),
    // Absent = duree par defaut de l'etat ; null = jusqu'a ce qu'on le retire.
    rounds: z.int().min(1).max(100).nullable().optional(),
  }),
  retirerEtat: z.strictObject({ idPersonnage, idEtat: schemaId("e") }),
};

export function brancher(socket, ctx) {
  const { depot, io } = ctx;
  const pseudo = socket.data.profil.pseudo;

  // --- Creation / suppression --------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.PERSONNAGE_CREER, Demandes.creer, ({ donnees }) => {
    const idTable = ctx.exigerTable(socket);
    const demande = { ...(donnees ?? {}) };

    // Un joueur cree toujours SA fiche ; le MJ choisit le proprietaire (ou PNJ).
    let proprietaire;
    if (ctx.estMJ(socket)) {
      // La forme exacte (texte de 2 a 24 caracteres) est verifiee par le schema.
      proprietaire = typeof demande.proprietaire === "string" ? demande.proprietaire.trim() || null : null;
    } else {
      if (demande.proprietaire !== undefined) throw new ErreurRegle("Seul le MJ peut attribuer une fiche.");
      proprietaire = pseudo;
    }

    const personnage = ctx.publierPersonnage(fabriquerPersonnage(demande, { idTable, proprietaire }), {
      action: "creation",
      par: pseudo,
    });
    return { personnage };
  });

  ctx.guichet(socket, EVENEMENTS.PERSONNAGE_SUPPRIMER, Demandes.cibler, ({ idPersonnage }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    depot.supprimerPersonnage(personnage.id);
    io.to(ctx.salleDuPersonnage(personnage)).emit(EVENEMENTS.PERSONNAGE_SUPPRIME, {
      idPersonnage: personnage.id,
      par: pseudo,
    });

    // S'il combattait, il quitte le combat.
    const combat = depot.obtenirCombat(personnage.idTable);
    const participant = combat?.participants.find((p) => p.idPersonnage === personnage.id);
    if (participant) {
      const suite = retirerParticipant(combat, participant.id);
      if (suite) depot.enregistrerCombat(suite);
      else depot.supprimerCombat(personnage.idTable);
      ctx.publierCombat(personnage.idTable, { action: "retrait", nom: personnage.nom, par: pseudo });
    }
    return {};
  });

  // --- Points de vie -------------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.PERSONNAGE_MODIFIER_PV, Demandes.modifierPv, ({ idPersonnage, type, montant }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const { pointsDeVie, detail } = appliquerPointsDeVie(personnage.pointsDeVie, type, montant);
    return {
      personnage: ctx.publierPersonnage(
        { ...personnage, pointsDeVie },
        { action: "points-de-vie", par: pseudo, ...detail },
      ),
    };
  });

  // --- Ressources ----------------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.RESSOURCE_MODIFIER, Demandes.modifierRessource, ({ idPersonnage, cle, variation }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const ressource = personnage.ressources.find((r) => r.cle === cle);
    if (!ressource) throw new ErreurRegle("Ressource inconnue sur ce personnage.");

    const apres = modifierRessource(ressource, variation);
    return {
      personnage: ctx.publierPersonnage(
        { ...personnage, ressources: personnage.ressources.map((r) => (r.cle === cle ? apres : r)) },
        { action: "ressource", par: pseudo, nom: ressource.nom, avant: ressource.actuel, apres: apres.actuel },
      ),
    };
  });

  ctx.guichet(socket, EVENEMENTS.RESSOURCE_AJOUTER, Demandes.ajouterRessource, ({ idPersonnage, modele, max }) => {
    ctx.exigerMJ(socket, "ajouter une ressource");
    const personnage = ctx.exigerPersonnageVisible(socket, idPersonnage);
    if (personnage.ressources.some((r) => r.cle === modele)) {
      throw new ErreurRegle(`${personnage.nom} possede deja cette ressource.`);
    }
    const { max: maxParDefaut, ...regles } = MODELES_RESSOURCES[modele];
    const plafond = max ?? maxParDefaut;
    // Une jauge qui se vide au repos (Rage) demarre vide ; les autres, pleines.
    const ressource = { cle: modele, ...regles, max: plafond, actuel: regles.reposLong === "vider" ? 0 : plafond };
    return {
      personnage: ctx.publierPersonnage(
        { ...personnage, ressources: [...personnage.ressources, ressource] },
        { action: "ressource-ajoutee", par: pseudo, nom: ressource.nom },
      ),
    };
  });

  ctx.guichet(socket, EVENEMENTS.RESSOURCE_RETIRER, Demandes.retirerRessource, ({ idPersonnage, cle }) => {
    ctx.exigerMJ(socket, "retirer une ressource");
    const personnage = ctx.exigerPersonnageVisible(socket, idPersonnage);
    const ressource = personnage.ressources.find((r) => r.cle === cle);
    if (!ressource) throw new ErreurRegle("Ressource inconnue sur ce personnage.");
    return {
      personnage: ctx.publierPersonnage(
        { ...personnage, ressources: personnage.ressources.filter((r) => r.cle !== cle) },
        { action: "ressource-retiree", par: pseudo, nom: ressource.nom },
      ),
    };
  });

  // --- Etats (auras / debuffs) ------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.ETAT_POSER, Demandes.poserEtat, ({ idPersonnage, cle, rounds }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const definition = ctx.compendium.obtenirDefinitionEtat(cle);
    if (!definition) throw new ErreurRegle("Etat inconnu (ni officiel, ni dans le compendium).");

    const duree = rounds === undefined ? (definition.dureeParDefaut ?? null) : rounds;
    const resultat = poserEtat(personnage, definition, { rounds: duree, par: pseudo });
    return {
      personnage: ctx.publierPersonnage(resultat.personnage, {
        action: "etat-pose",
        par: pseudo,
        etat: resultat.etat,
        rafraichi: resultat.rafraichi,
      }),
    };
  });

  ctx.guichet(socket, EVENEMENTS.ETAT_RETIRER, Demandes.retirerEtat, ({ idPersonnage, idEtat }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const resultat = retirerEtat(personnage, idEtat);
    return {
      personnage: ctx.publierPersonnage(resultat.personnage, {
        action: "etat-retire",
        par: pseudo,
        etat: resultat.etat,
      }),
    };
  });
}
