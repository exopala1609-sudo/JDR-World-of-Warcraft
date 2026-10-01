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
import { sortDebloque } from "../../../shared/magie.js";
import { nouvelId, schemaId } from "../modeles/identifiants.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { modifierRessource } from "../regles/ressources.js";
import { jetSort, jetTest } from "../regles/resolution.js";
import { salleMJ, salleTable } from "./index.js";

const Demandes = {
  lancer: z.strictObject({ idPersonnage: schemaId("p"), reference: z.string().min(1).max(80) }),
  valider: z.strictObject({ idJet: schemaId("r") }),
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
export function proposerJet(ctx, socket, personnage, jet) {
  for (const enAttente of ctx.jets.values()) {
    if (enAttente.idPersonnage === personnage.id) throw new ErreurRegle("Valide d'abord le jet en cours.");
  }
  const complet = {
    id: nouvelId("r"),
    idPersonnage: personnage.id,
    idTable: personnage.idTable,
    personnage: personnage.nom,
    par: socket.data.profil.pseudo,
    idSocket: socket.id,
    statut: "en-attente",
    ...jet,
  };
  ctx.jets.set(complet.id, complet);
  const { idSocket: _s, ...visible } = complet;
  ctx.io.to(salleMJ(personnage.idTable)).emit(EVENEMENTS.JET_EN_COURS, { jet: visible });
  return visible;
}

/** Annonce le resultat a toute la table et oublie le jet. */
function validerJet(ctx, jet) {
  ctx.jets.delete(jet.id);
  const { idSocket: _s, ...visible } = jet;
  ctx.io.to(salleTable(jet.idTable)).emit(EVENEMENTS.JET_RESULTAT, { jet: { ...visible, statut: "valide" } });
}

export function brancher(socket, ctx) {
  const pseudo = socket.data.profil.pseudo;

  // Lancer un sort du grimoire (clic sur la barre d'actions).
  ctx.guichet(socket, EVENEMENTS.SORT_LANCER, Demandes.lancer, ({ idPersonnage, reference }) => {
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
    if (sort.cout) {
      const ressource = personnage.ressources.find((r) => r.cle === sort.cout.ressource);
      if (!ressource) {
        const nom = ctx.referentiel.obtenirRessource(sort.cout.ressource)?.nom ?? sort.cout.ressource;
        throw new ErreurRegle(`${personnage.nom} n'a pas de ${nom} pour lancer ${sort.nom}.`);
      }
      const apres = modifierRessource(ressource, -sort.cout.quantite); // refuse si pas assez
      fiche = { ...fiche, ressources: personnage.ressources.map((r) => (r.cle === ressource.cle ? apres : r)) };
      cout = `${sort.cout.quantite} ${ressource.nom}`;
    }
    const jet = proposerJet(ctx, socket, personnage, { ...jetSort(personnage, sort, classe), cout });
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
