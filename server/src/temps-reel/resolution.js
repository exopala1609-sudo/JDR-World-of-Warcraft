// Domaine "resolution" : la fenetre de des facon Baldur's Gate 3.
//
// DEROULE d'une action (sort, attaque) :
//  1. Le joueur clique sur sa barre d'actions. Son navigateur DEMANDE l'action.
//  2. Le SERVEUR lit la fiche (caracteristiques, maitrise, arme, sort), lance
//     les des, detaille chaque modificateur, depense le Mana... et garde le jet
//     "en attente". Le joueur ET le MJ voient aussitot la fenetre de resolution.
//  3. Le joueur clique "Valider" : le resultat est annonce a toute la table.
//
// ANTI-TRICHE : le joueur ne peut ni modifier les chiffres (ils viennent du
// serveur), ni relancer jusqu'a obtenir un 20 : le MJ voit chaque jet des sa
// creation, et un seul jet peut etre en attente par personnage.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { CARACTERISTIQUES } from "../../../shared/dnd5e.js";
import { ETATS_DE_BASE } from "../../../shared/etats.js";
import { emplacementsDuPersonnage, sortDebloque } from "../../../shared/magie.js";
import { nouvelId, schemaId } from "../modeles/identifiants.js";
import { z } from "../modeles/zod.js";
import { cibleDuJet, effetSurLaCible, idCible } from "../regles/cible.js";
import { depenserEmplacement } from "../regles/emplacements.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { poserEtat } from "../regles/etats.js";
import { modifierRessource } from "../regles/ressources.js";
import { jetAttaqueMonstre, jetSort, jetTest } from "../regles/resolution.js";
import { salleMJ, salleTable } from "./index.js";

const avantage = z.enum(["normal", "avantage", "desavantage"]).default("normal");

const Demandes = {
  lancer: z.strictObject({
    idPersonnage: schemaId("p"),
    reference: z.string().min(1).max(80),
    niveau: z.int().min(1).max(9).optional(), // l'emplacement utilise (upcast) ; par defaut celui du sort
    idCible,
  }),
  valider: z.strictObject({ idJet: schemaId("r") }),
  attaque: z.strictObject({ idPersonnage: schemaId("p"), reference: z.string().min(1).max(60), avantage, idCible }),
  test: z.strictObject({
    idPersonnage: schemaId("p"),
    genre: z.enum(["caracteristique", "sauvegarde"]),
    caracteristique: z.enum(CARACTERISTIQUES),
    avantage: z.enum(["normal", "avantage", "desavantage"]).default("normal"),
  }),
};

/** Le sort du grimoire designe par un raccourci : par son origine dans le compendium, ou son identifiant. */
export const sortDuGrimoire = (fiche, reference) => fiche.grimoire.find((s) => s.source === reference || s.id === reference) ?? null;

/**
 * Enregistre un jet "en attente" et previent le MJ (sa fenetre s'ouvre aussi).
 * Utilise par les sorts (ici) et par les attaques a l'arme (equipement.js).
 */
export function proposerJet(ctx, socket, personnage, jet, { secret = false } = {}) {
  const pseudo = socket.data.profil.pseudo;
  // Un seul jet en attente par personnage (des libres : par joueur).
  const cle = personnage ? personnage.id : `libre:${pseudo.toLocaleLowerCase("fr")}`;
  for (const enAttente of ctx.jets.values()) {
    if (enAttente.cle === cle) throw new ErreurRegle("Valide d'abord le jet en cours.");
  }
  const complet = {
    id: nouvelId("r"),
    cle,
    idPersonnage: personnage?.id ?? null,
    idTable: personnage?.idTable ?? ctx.exigerTable(socket),
    // Des libres d'un joueur : au nom de son personnage ("Garrosh"), le MJ : a son pseudo.
    personnage: personnage?.nom ?? (ctx.estMJ(socket) ? null : ctx.personnageDuJoueur(socket, ctx.exigerTable(socket))?.nom) ?? pseudo,
    par: pseudo,
    idSocket: socket.id,
    statut: "en-attente",
    // Jet secret : demande par le MJ, ou jet d'un monstre que les joueurs ne
    // voient pas (cache, ou dans le brouillard) : le resultat ne va qu'au MJ.
    secret: secret || Boolean(personnage && !ctx.pnjVisible(personnage)),
    ...jet,
  };
  ctx.jets.set(complet.id, complet);
  const { idSocket: _s, cle: _c, ...visible } = complet;
  ctx.io.to(salleMJ(complet.idTable)).emit(EVENEMENTS.JET_EN_COURS, { jet: visible });
  return visible;
}

/**
 * Annonce le resultat a toute la table et oublie le jet. Avec une cible : le
 * texte de combat flottant au-dessus de son pion (couleur du type de degats,
 * gros et secoue sur un critique) et "touche / rate" dans la discussion.
 */
function validerJet(ctx, jet) {
  ctx.jets.delete(jet.id);
  const { idSocket: _s, cle: _c, ...visible } = jet;
  const cible = jet.cible ? ctx.depot.obtenirPersonnage(jet.cible.idPersonnage) : null;
  const effet = cible ? effetSurLaCible(jet, cible) : null;
  const salle = jet.secret ? salleMJ(jet.idTable) : salleTable(jet.idTable);
  const resultat = { ...visible, statut: "valide", ...(effet && { cible: { ...jet.cible, touche: effet.touche } }) };
  ctx.io.to(salle).emit(EVENEMENTS.JET_RESULTAT, { jet: resultat });
  if (cible && effet?.texte) ctx.publierTexteCombat(cible, effet.texte, { seulementMJ: jet.secret });
}

export function brancher(socket, ctx) {
  const pseudo = socket.data.profil.pseudo;

  // Lancer un sort du grimoire (clic sur la barre d'actions).
  ctx.guichet(socket, EVENEMENTS.SORT_LANCER, Demandes.lancer, ({ idPersonnage, reference, niveau, idCible: cible }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const sort = sortDuGrimoire(personnage, reference);
    if (!sort) throw new ErreurRegle("Ce sort n'est pas (ou plus) dans le grimoire.");
    const classe = ctx.referentiel.obtenirClasse(personnage.classe);
    if (!sortDebloque(sort, personnage.niveau, classe?.progressionSorts)) {
      throw new ErreurRegle(`${sort.nom} est encore hors de portee de ${personnage.nom} (sort de niveau ${sort.niveau}).`);
    }

    // Le cout (Mana...) est paye au lancement : une fois les des jetes, pas de retour en arriere.
    let fiche = { ...personnage, repose: false };
    let cout = null;

    // Emplacement de sort (sorts de niveau 1 et plus, pour un lanceur de sorts) :
    // au niveau du sort, ou plus haut pour le renforcer ("upcast").
    const niveauLance = sort.niveau === 0 ? 0 : (niveau ?? sort.niveau);
    if (niveauLance < sort.niveau) throw new ErreurRegle(`${sort.nom} se lance au niveau ${sort.niveau} au minimum.`);
    const aDesEmplacements = emplacementsDuPersonnage(personnage, classe).length > 0;
    if (sort.niveau > 0 && aDesEmplacements) {
      fiche = { ...fiche, ressources: depenserEmplacement(fiche, niveauLance, classe) };
    } else if (niveauLance > sort.niveau) {
      throw new ErreurRegle(`${personnage.nom} n'a pas d'emplacement de sort pour le renforcer.`);
    }
    if (sort.cout) {
      const ressource = personnage.ressources.find((r) => r.cle === sort.cout.ressource);
      if (!ressource) {
        const nom = ctx.referentiel.obtenirRessource(sort.cout.ressource)?.nom ?? sort.cout.ressource;
        throw new ErreurRegle(`${personnage.nom} n'a pas de ${nom} pour lancer ${sort.nom}.`);
      }
      const apres = modifierRessource(ressource, -sort.cout.quantite); // refuse si pas assez
      fiche = { ...fiche, ressources: fiche.ressources.map((r) => (r.cle === ressource.cle ? apres : r)) };
      cout = `${sort.cout.quantite} ${ressource.nom}`;
    }
    if (sort.niveau > 0 && aDesEmplacements) cout = [`Emplacement de niveau ${niveauLance}`, cout].filter(Boolean).join(" + ");

    // Sort a concentration : l'aura s'affiche sous le portrait du lanceur (une
    // seule a la fois : la nouvelle remplace l'ancienne, comme dans les regles).
    if (sort.concentration) {
      const definition = { cle: "concentration", ...ETATS_DE_BASE.concentration, nom: `Concentration : ${sort.nom}` };
      fiche = poserEtat(fiche, definition, { par: pseudo }).personnage;
    }

    const jet = proposerJet(ctx, socket, personnage, {
      ...jetSort(personnage, sort, classe, undefined, niveauLance),
      cout,
      cible: cibleDuJet(ctx, socket, personnage, cible),
    });
    ctx.publierPersonnage(fiche, { action: "sort-lance", par: pseudo, nom: sort.nom, cout });
    return { jet };
  });

  // Test de caracteristique / sauvegarde (boutons du lanceur de des) : le
  // bonus est lu dans la fiche PAR LE SERVEUR, le joueur ne choisit que quoi tester.
  ctx.guichet(socket, EVENEMENTS.TEST_LANCER, Demandes.test, ({ idPersonnage, genre, caracteristique, avantage }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const classe = ctx.referentiel.obtenirClasse(personnage.classe);
    const jet = proposerJet(ctx, socket, personnage, { ...jetTest(personnage, genre, caracteristique, classe, avantage), cout: null });
    return { jet };
  });

  // Attaque d'un monstre du bestiaire (menu du MJ, ou barre d'actions du monstre).
  ctx.guichet(socket, EVENEMENTS.MONSTRE_ATTAQUER, Demandes.attaque, ({ idPersonnage, reference, avantage: mode, idCible: cible }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const attaque = personnage.attaquesMonstre.find((a) => a.nom === reference);
    if (!attaque) throw new ErreurRegle(`${personnage.nom} ne connait pas l'attaque "${reference}".`);
    return {
      jet: proposerJet(ctx, socket, personnage, {
        ...jetAttaqueMonstre(personnage, attaque, undefined, mode),
        cout: null,
        cible: cibleDuJet(ctx, socket, personnage, cible),
      }),
    };
  });

  // "Valider" : le lanceur (ou le MJ) annonce le resultat a la table.
  ctx.guichet(socket, EVENEMENTS.JET_VALIDER, Demandes.valider, ({ idJet }) => {
    const jet = ctx.jets.get(idJet);
    if (!jet) throw new ErreurRegle("Ce jet a deja ete valide.");
    if (!ctx.estMJ(socket) && jet.par.toLocaleLowerCase("fr") !== pseudo.toLocaleLowerCase("fr")) {
      throw new ErreurRegle("Ce n'est pas ton jet.");
    }
    validerJet(ctx, jet);
    return {};
  });

  // Navigateur ferme avec une fenetre ouverte : le jet est valide tel quel
  // (il a ete lance, le MJ l'a vu : il compte).
  socket.on("disconnect", () => {
    for (const jet of ctx.jets.values()) if (jet.idSocket === socket.id) validerJet(ctx, jet);
  });
}
