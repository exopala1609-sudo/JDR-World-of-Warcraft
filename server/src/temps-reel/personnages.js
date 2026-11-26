// Domaine "personnages" : creation, points de vie, ressources et etats.
import { EVENEMENTS, TYPES_PV } from "../../../shared/protocole.js";
import { listerImages } from "../medias.js";
import { schemaId } from "../modeles/identifiants.js";
import { fabriquerPersonnage, fabriquerPersonnageGuide } from "../modeles/personnage.js";
import { schemaIdReferentiel } from "../modeles/referentiel.js";
import { z } from "../modeles/zod.js";
import { retirerParticipant } from "../regles/combat.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { poserEtat, retirerEtat } from "../regles/etats.js";
import { appliquerPointsDeVie, texteDeCombat } from "../regles/points-de-vie.js";
import { modifierRessource } from "../regles/ressources.js";
import { caseLibreProche, placerPion } from "../regles/scene.js";
import { appliquerTirage, autoriserRelance, tirerCaracteristiques, totalTirage, valeursRetenues } from "../regles/tirage.js";
import { normaliserPseudo } from "../auth/sessions.js";
import { methodesDeLaTable } from "../../../shared/creation.js";
import { salleCreation, salleTable } from "./index.js";

const idPersonnage = schemaId("p");
const cleRessource = z.string().regex(/^[a-z0-9-]{1,40}$/);

const Demandes = {
  creer: z.strictObject({ donnees: z.unknown() }),
  cibler: z.strictObject({ idPersonnage }),
  modifierPv: z.strictObject({
    idPersonnage,
    type: z.enum(Object.values(TYPES_PV)),
    montant: z.int().min(0).max(10_000),
    critique: z.boolean().default(false), // coup critique : gros chiffres jaunes
    // Le MJ applique le resultat d'un jet cible : son texte flottant s'est deja affiche.
    sansTexte: z.boolean().default(false),
  }),
  modifierRessource: z.strictObject({ idPersonnage, cle: cleRessource, variation: z.int().min(-999).max(999) }),
  ajouterRessource: z.strictObject({
    idPersonnage,
    modele: schemaIdReferentiel, // une ressource du referentiel (ressources.json)
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
  autoriserRelance: z.strictObject({ pseudo: z.string().trim().min(1).max(24) }),
};

export function brancher(socket, ctx) {
  const { depot, io } = ctx;
  const pseudo = socket.data.profil.pseudo;

  /**
   * PV, ressources et etats modifies "a la main" : le MJ toujours ; un joueur
   * (sur SON personnage) seulement si le MJ l'a permis pour cette table.
   * Ce que le serveur calcule lui-meme (sorts, attaques, repos) n'est pas concerne.
   */
  function exigerModificationManuelle(idPersonnage) {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    if (!ctx.estMJ(socket) && !depot.obtenirTable(personnage.idTable)?.reglages?.joueursModifientPv) {
      throw new ErreurRegle("A cette table, c'est le MJ qui modifie les PV, ressources et etats.");
    }
    return personnage;
  }

  // --- Creation / suppression --------------------------------------------------

  // "Entrer dans le monde" : le joueur envoie ses CHOIX depuis l'ecran de
  // creation. Le serveur verifie tout d'apres le referentiel, enregistre la
  // fiche, pose le pion pres du groupe, puis fait entrer le joueur en jeu.
  ctx.guichet(socket, EVENEMENTS.CREATION_VALIDER, Demandes.creer, async ({ donnees }) => {
    if (ctx.estMJ(socket)) throw new ErreurRegle("Le MJ cree ses personnages depuis les outils du MJ.");
    const idTable = socket.data.idTableCreation;
    if (!idTable || !depot.obtenirTable(idTable)) throw new ErreurRegle("Choisis d'abord une table.");
    // Deux onglets ouverts, deux clics : un seul personnage par joueur et par table.
    if (ctx.personnageDuJoueur(socket, idTable)) throw new ErreurRegle("Tu as deja un personnage a cette table.");

    const table = depot.obtenirTable(idTable);
    const personnage = fabriquerPersonnageGuide(donnees, {
      idTable,
      proprietaire: pseudo,
      referentiel: ctx.referentiel,
      portraits: listerImages(ctx.config, "portraits"),
      loreLibre: Boolean(table.reglages?.loreLibre),
      methodes: methodesDeLaTable(ctx.referentiel.reglesCreation(), table.reglages),
      valeursTirage: valeursRetenues(table.tirages?.[normaliserPseudo(pseudo)]),
    });
    ctx.publierPersonnage(personnage, { action: "creation", par: pseudo }); // la table voit arriver le nouveau
    // Le tirage a servi : on le retire de la table.
    if (table.tirages?.[normaliserPseudo(pseudo)]) {
      const { [normaliserPseudo(pseudo)]: _utilise, ...autres } = table.tirages;
      ctx.publierTable(depot.enregistrerTable({ ...table, tirages: autres }));
    }

    // Son pion apparait sur la carte, sur une case libre pres des autres heros.
    const scene = depot.obtenirScene(idTable);
    const heros = scene.pions.filter((p) => depot.obtenirPersonnage(p.idPersonnage)?.proprietaire);
    const depart = heros.length
      ? { x: heros.reduce((t, p) => t + p.x, 0) / heros.length, y: heros.reduce((t, p) => t + p.y, 0) / heros.length }
      : { x: scene.carte.largeur / 2, y: scene.carte.hauteur / 2 };
    depot.enregistrerScene(placerPion(scene, personnage, caseLibreProche(scene, depart)).scene);
    ctx.publierScene(idTable, { action: "pion-place", par: pseudo, nom: personnage.nom });

    return ctx.entrerDansLaTable(socket, idTable);
  });

  // Tirer ses caracteristiques aux des (4d6, on garde les 3 meilleurs), depuis
  // l'ecran de creation. Une seule fois ; ensuite, seulement si le MJ autorise
  // une relance, et le joueur garde le meilleur des deux tirages.
  ctx.guichet(socket, EVENEMENTS.CREATION_TIRER, null, () => {
    if (ctx.estMJ(socket)) throw new ErreurRegle("Le MJ n'a pas de caracteristiques a tirer.");
    const idTable = socket.data.idTableCreation;
    const table = idTable ? depot.obtenirTable(idTable) : null;
    if (!table) throw new ErreurRegle("Choisis d'abord une table.");
    if (ctx.personnageDuJoueur(socket, idTable)) throw new ErreurRegle("Tu as deja un personnage a cette table.");
    if (!methodesDeLaTable(ctx.referentiel.reglesCreation(), table.reglages).includes("tirage-4d6")) {
      throw new ErreurRegle("Le MJ n'a pas permis le tirage aux des a cette table.");
    }

    const cle = normaliserPseudo(pseudo);
    const ancienne = table.tirages?.[cle] ?? null;
    const tirage = tirerCaracteristiques();
    const { entree, garde } = appliquerTirage(ancienne, tirage.valeurs, pseudo);
    const nouvelle = depot.enregistrerTable({ ...table, tirages: { ...(table.tirages ?? {}), [cle]: entree } });

    // Toute la table voit les des (et le joueur lui-meme, a la porte).
    const annonce = {
      pseudo,
      valeurs: tirage.valeurs,
      des: tirage.des,
      total: totalTirage(tirage.valeurs),
      relance: Boolean(ancienne),
      garde,
      retenu: valeursRetenues(entree),
    };
    io.to([salleTable(idTable), salleCreation(idTable)]).emit(EVENEMENTS.CREATION_TIRAGE, annonce);
    ctx.publierTable(nouvelle);
    return { tirage: annonce, table: nouvelle };
  });

  // Le MJ autorise un joueur a relancer ses des de creation.
  ctx.guichet(socket, EVENEMENTS.CREATION_AUTORISER_RELANCE, Demandes.autoriserRelance, ({ pseudo: cible }) => {
    ctx.exigerMJ(socket, "autoriser une relance");
    const idTable = ctx.exigerTable(socket);
    const table = depot.obtenirTable(idTable);
    const cle = normaliserPseudo(cible);
    const entree = autoriserRelance(table.tirages?.[cle] ?? null);
    const nouvelle = depot.enregistrerTable({ ...table, tirages: { ...table.tirages, [cle]: entree } });
    ctx.publierTable(nouvelle);
    return { table: nouvelle };
  });

  // Creation libre, reservee au MJ (PNJ, monstres, ou fiche attribuee a un joueur).
  ctx.guichet(socket, EVENEMENTS.PERSONNAGE_CREER, Demandes.creer, ({ donnees }) => {
    if (!ctx.estMJ(socket)) throw new ErreurRegle("Cree ton personnage depuis l'ecran de creation.");
    const idTable = ctx.exigerTable(socket);
    const demande = { ...(donnees ?? {}) };
    // La forme exacte (texte de 2 a 24 caracteres) est verifiee par le schema.
    const proprietaire = typeof demande.proprietaire === "string" ? demande.proprietaire.trim() || null : null;

    const personnage = ctx.publierPersonnage(fabriquerPersonnage(demande, { idTable, proprietaire, referentiel: ctx.referentiel }), {
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

    // S'il etait sur la carte, son pion disparait.
    const scene = depot.obtenirScene(personnage.idTable);
    const pion = scene.pions.find((j) => j.idPersonnage === personnage.id);
    if (pion) {
      depot.enregistrerScene({ ...scene, pions: scene.pions.filter((j) => j.id !== pion.id) });
      ctx.publierScene(personnage.idTable, { action: "pion-retire", par: pseudo });
    }

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

  ctx.guichet(socket, EVENEMENTS.PERSONNAGE_MODIFIER_PV, Demandes.modifierPv, ({ idPersonnage, type, montant, critique, sansTexte }) => {
    const personnage = exigerModificationManuelle(idPersonnage);
    const { pointsDeVie, detail } = appliquerPointsDeVie(personnage.pointsDeVie, type, montant);
    const coupCritique = critique && type === TYPES_PV.DEGATS; // un soin n'est jamais "critique"
    const publie = ctx.publierPersonnage(
      // Prendre des coups met fin a l'etat "repose".
      { ...personnage, pointsDeVie, repose: type === TYPES_PV.DEGATS && montant > 0 ? false : personnage.repose },
      { action: "points-de-vie", par: pseudo, ...detail, critique: coupCritique },
    );
    if (!sansTexte) ctx.publierTexteCombat(personnage, texteDeCombat(detail, { critique: coupCritique }));
    return { personnage: publie };
  });

  // --- Ressources ----------------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.RESSOURCE_MODIFIER, Demandes.modifierRessource, ({ idPersonnage, cle, variation }) => {
    const personnage = exigerModificationManuelle(idPersonnage);
    const ressource = personnage.ressources.find((r) => r.cle === cle);
    if (!ressource) throw new ErreurRegle("Ressource inconnue sur ce personnage.");

    const apres = modifierRessource(ressource, variation);
    return {
      personnage: ctx.publierPersonnage(
        // Depenser une ressource met fin a l'etat "repose".
        { ...personnage, ressources: personnage.ressources.map((r) => (r.cle === cle ? apres : r)), repose: variation < 0 ? false : personnage.repose },
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
    const m = ctx.referentiel.obtenirRessource(modele);
    if (!m) throw new ErreurRegle(`Ressource inconnue du referentiel : "${modele}".`);
    const plafond = max ?? m.max;
    const ressource = {
      cle: m.id,
      nom: m.nom,
      type: m.type,
      max: plafond,
      actuel: m.depart === "vide" ? 0 : plafond, // la Rage demarre vide
      reposCourt: m.reposCourt,
      reposLong: m.reposLong,
      apparence: m.id,
    };
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
    const personnage = exigerModificationManuelle(idPersonnage);
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
    const personnage = exigerModificationManuelle(idPersonnage);
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
