// Domaine "butin" : coffres et cadavres a fouiller sur la carte.
//
// ANTI-TRICHE, en trois verrous :
//  1. VOIR : un joueur ne recoit jamais le contenu d'un butin a distance.
//     La carte ne lui dit que "il y a un coffre ici" (et s'il est vide).
//     Le contenu n'est envoye qu'a l'ouverture, s'il est visible (hors du
//     brouillard, non cache) et que son pion est a cote (2 cases).
//  2. PRENDRE : memes verifications, refaites a chaque objet.
//  3. PAS DE DOUBLE PILLAGE : Node.js traite les demandes UNE PAR UNE. Le
//     premier joueur retire l'objet du coffre ; le second, qui a clique au
//     meme instant, trouve la place vide et recoit "Quelqu'un a deja pris
//     cet objet." L'objet ne peut exister qu'a un seul endroit.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { instancierObjet } from "../donnees/compendium.js";
import { schemaIdCompendium } from "../modeles/compendium.js";
import { schemaId } from "../modeles/identifiants.js";
import { z } from "../modeles/zod.js";
import { aPortee, butinVisibleParLesJoueurs, creerButin, exigerButin, PORTEE_DE_FOUILLE, prendreDansButin } from "../regles/butins.js";
import { retirerParticipant } from "../regles/combat.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { ajouterAuSac } from "../regles/inventaire.js";
import { positionValide } from "../regles/scene.js";

const idButin = schemaId("b");
const coordonnee = z.number().min(-100_000).max(100_000);
const Demandes = {
  ouvrir: z.strictObject({ idButin }),
  fermer: z.strictObject({ idButin: idButin.optional() }),
  prendre: z.strictObject({ idButin, idObjet: schemaId("o"), idPersonnage: schemaId("p").optional() }),
  creer: z.strictObject({
    genre: z.enum(["coffre", "cadavre"]).default("coffre"),
    nom: z.string().trim().min(1).max(60),
    x: coordonnee.optional(),
    y: coordonnee.optional(),
  }),
  ajouter: z.strictObject({ idButin, idObjet: schemaIdCompendium, quantite: z.int().min(1).max(999).default(1) }),
  supprimer: z.strictObject({ idButin }),
  deplacer: z.strictObject({ idButin, x: coordonnee, y: coordonnee }),
  cadavre: z.strictObject({ idPion: schemaId("j") }),
};

const salleButin = (id) => `butin:${id}`;
const vueDuButin = (b) => ({ id: b.id, nom: b.nom, genre: b.genre, objets: b.objets });

export function brancher(socket, ctx) {
  const { depot, io } = ctx;
  const pseudo = socket.data.profil.pseudo;

  /** Le butin existe, et CE navigateur a le droit d'y fouiller maintenant. */
  function exigerAcces(scene, id) {
    const butin = exigerButin(scene, id);
    if (ctx.estMJ(socket)) return { butin, personnage: null };
    if (!butinVisibleParLesJoueurs(scene, butin)) throw new ErreurRegle("Ce butin n'existe plus.");
    const personnage = ctx.personnageDuJoueur(socket, scene.idTable);
    if (!personnage) throw new ErreurRegle("Il te faut un personnage pour fouiller.");
    if (!aPortee(scene, butin, personnage.id)) {
      throw new ErreurRegle(`Approche-toi : il faut etre a ${PORTEE_DE_FOUILLE} cases au plus pour fouiller.`);
    }
    return { butin, personnage };
  }

  /** Apres un changement : les fenetres ouvertes se mettent a jour, et la carte (coffre vide...). */
  function diffuserButin(scene, butin, cause) {
    io.to(salleButin(butin.id)).emit(EVENEMENTS.BUTIN_MAJ, butin.supprime ? { idButin: butin.id, supprime: true } : { idButin: butin.id, butin: vueDuButin(butin) });
    ctx.publierScene(scene.idTable, cause);
  }

  function quitterButinOuvert() {
    if (socket.data.butinOuvert) socket.leave(salleButin(socket.data.butinOuvert));
    socket.data.butinOuvert = null;
  }

  // --- Fouiller --------------------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.BUTIN_OUVRIR, Demandes.ouvrir, ({ idButin: id }) => {
    const scene = depot.obtenirScene(ctx.exigerTable(socket));
    const { butin } = exigerAcces(scene, id);
    quitterButinOuvert();
    socket.join(salleButin(id)); // pour voir en direct les autres se servir
    socket.data.butinOuvert = id;
    return { butin: vueDuButin(butin) };
  });

  ctx.guichet(socket, EVENEMENTS.BUTIN_FERMER, Demandes.fermer, () => {
    quitterButinOuvert();
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.BUTIN_PRENDRE, Demandes.prendre, ({ idButin: id, idObjet, idPersonnage }) => {
    const idTable = ctx.exigerTable(socket);
    const scene = depot.obtenirScene(idTable);
    const acces = exigerAcces(scene, id);
    // Un joueur remplit SON sac ; le MJ distribue au personnage qu'il a cible.
    const destinataire = acces.personnage ?? (idPersonnage ? ctx.exigerPersonnageVisible(socket, idPersonnage) : null);
    if (!destinataire) throw new ErreurRegle("Cible d'abord le personnage qui recoit l'objet.");

    const { scene: suite, butin, objet } = prendreDansButin(scene, id, idObjet);
    depot.enregistrerScene(suite);
    const personnage = ctx.publierPersonnage(
      { ...destinataire, inventaire: ajouterAuSac(destinataire.inventaire, objet) },
      { action: "objet-recu", par: pseudo, nom: objet.nom, rarete: objet.rarete, quantite: objet.quantite, origine: acces.butin.nom },
    );
    diffuserButin(suite, butin, { action: "butin-pris", par: pseudo });
    return { personnage, butin: vueDuButin(butin) };
  });

  // --- Outils du MJ -----------------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.BUTIN_CREER, Demandes.creer, ({ genre, nom, x, y }) => {
    ctx.exigerMJ(socket, "poser un butin");
    const scene = depot.obtenirScene(ctx.exigerTable(socket));
    const position = positionValide(scene, x ?? scene.carte.largeur / 2, y ?? scene.carte.hauteur / 2);
    const { scene: suite, butin } = creerButin(scene, { genre, nom, ...position });
    depot.enregistrerScene(suite);
    ctx.publierScene(scene.idTable, { action: "butin-cree", par: pseudo, nom });
    return { butin };
  });

  ctx.guichet(socket, EVENEMENTS.BUTIN_AJOUTER, Demandes.ajouter, ({ idButin: id, idObjet, quantite }) => {
    ctx.exigerMJ(socket, "remplir un butin");
    const scene = depot.obtenirScene(ctx.exigerTable(socket));
    const butin = exigerButin(scene, id);
    const entree = ctx.compendium.obtenirObjet(idObjet);
    if (!entree) throw new ErreurRegle("Objet absent du compendium (recharge-le apres une modification).");
    const rempli = { ...butin, objets: ajouterAuSac(butin.objets, instancierObjet(entree, quantite)) };
    const suite = depot.enregistrerScene({ ...scene, butins: scene.butins.map((b) => (b.id === id ? rempli : b)) });
    diffuserButin(suite, rempli, { action: "butin-rempli", par: pseudo });
    return { butin: rempli };
  });

  ctx.guichet(socket, EVENEMENTS.BUTIN_SUPPRIMER, Demandes.supprimer, ({ idButin: id }) => {
    ctx.exigerMJ(socket, "retirer un butin");
    const scene = depot.obtenirScene(ctx.exigerTable(socket));
    exigerButin(scene, id);
    const suite = depot.enregistrerScene({ ...scene, butins: scene.butins.filter((b) => b.id !== id) });
    diffuserButin(suite, { id, supprime: true }, { action: "butin-supprime", par: pseudo });
    return {};
  });

  // Le MJ deplace un coffre / cadavre. Les joueurs recoivent la scene filtree :
  // un coffre glisse dans le brouillard disparait de leur carte, et inversement.
  ctx.guichet(socket, EVENEMENTS.BUTIN_DEPLACER, Demandes.deplacer, ({ idButin: id, x, y }) => {
    ctx.exigerMJ(socket, "deplacer un butin");
    const scene = depot.obtenirScene(ctx.exigerTable(socket));
    exigerButin(scene, id);
    const position = positionValide(scene, x, y);
    depot.enregistrerScene({ ...scene, butins: scene.butins.map((b) => (b.id === id ? { ...b, ...position } : b)) });
    ctx.publierScene(scene.idTable, { action: "butin-deplace", par: pseudo });
    return { position };
  });

  // Le monstre tombe : son pion laisse place a un cadavre, qui contient ce
  // qu'il portait (sac ET equipement). Sa fiche reste, pour le MJ.
  ctx.guichet(socket, EVENEMENTS.PION_EN_CADAVRE, Demandes.cadavre, ({ idPion }) => {
    ctx.exigerMJ(socket, "transformer un pion en cadavre");
    const idTable = ctx.exigerTable(socket);
    const scene = depot.obtenirScene(idTable);
    const pion = scene.pions.find((p) => p.id === idPion);
    if (!pion) throw new ErreurRegle("Ce pion n'est plus sur la carte.");
    const pnj = depot.obtenirPersonnage(pion.idPersonnage);
    if (!pnj || pnj.proprietaire !== null) throw new ErreurRegle("Seul un PNJ (monstre) peut devenir un cadavre.");

    const objets = [...pnj.inventaire, ...Object.values(pnj.equipement)];
    const { scene: avecCadavre } = creerButin(scene, { genre: "cadavre", nom: `Cadavre : ${pnj.nom}`, x: pion.x, y: pion.y, objets });
    depot.enregistrerScene({ ...avecCadavre, pions: avecCadavre.pions.filter((p) => p.id !== idPion) });
    ctx.publierPersonnage({ ...pnj, inventaire: [], equipement: {} }, { action: "depouille", par: pseudo });

    // S'il combattait, il quitte le combat.
    const combat = depot.obtenirCombat(idTable);
    const participant = combat?.participants.find((p) => p.idPersonnage === pnj.id);
    if (participant) {
      const reste = retirerParticipant(combat, participant.id);
      if (reste) depot.enregistrerCombat(reste);
      else depot.supprimerCombat(idTable);
      ctx.publierCombat(idTable, { action: "retrait", nom: pnj.nom, par: pseudo });
    }
    ctx.publierScene(idTable, { action: "cadavre", par: pseudo, nom: pnj.nom });
    return {};
  });

  socket.on("disconnect", quitterButinOuvert);
}
