// Domaine "compendium" : la bibliotheque du MJ, et ce qui en sort
// (objets vers les sacs, sorts vers les grimoires, images de son dossier).
//
// Pourquoi une COPIE dans le sac, et pas un simple lien vers le compendium ?
// Parce qu'un objet vit sa vie : si tu corriges demain la description de
// l'epee dans le compendium, l'epee deja ramassee ne change pas en douce dans
// le sac d'un joueur. Chaque exemplaire garde "source" pour savoir d'ou il vient.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { instancierObjet, instancierSort } from "../donnees/compendium.js";
import { listerImages } from "../medias.js";
import { schemaIdCompendium } from "../modeles/compendium.js";
import { schemaId } from "../modeles/identifiants.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { SALLE_MJ } from "./index.js";

const idPersonnage = schemaId("p");
const QUANTITE_MAX = 9999;

const Demandes = {
  ajouterObjet: z.strictObject({ idPersonnage, idObjet: schemaIdCompendium, quantite: z.int().min(1).max(999).default(1) }),
  retirerObjet: z.strictObject({ idPersonnage, idObjet: schemaId("o"), quantite: z.int().min(1).max(QUANTITE_MAX).optional() }),
  apprendre: z.strictObject({ idPersonnage, idSort: schemaIdCompendium }),
  oublier: z.strictObject({ idPersonnage, idSort: schemaId("s") }),
  medias: z.strictObject({ categorie: z.enum(["cartes", "jetons", "portraits", "icones"]) }),
};

export function brancher(socket, ctx) {
  const pseudo = socket.data.profil.pseudo;

  // --- Bibliotheque -------------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.COMPENDIUM_LISTER, null, () => {
    ctx.exigerMJ(socket, "consulter le compendium");
    return ctx.compendium.lister();
  });

  ctx.guichet(socket, EVENEMENTS.COMPENDIUM_RECHARGER, null, () => {
    ctx.exigerMJ(socket, "recharger le compendium");
    const rapport = ctx.compendium.charger();
    console.log(`[compendium] Recharge : ${rapport.objets} objets, ${rapport.sorts} sorts, ${rapport.etats} etats.`);
    ctx.io.to(SALLE_MJ).emit(EVENEMENTS.COMPENDIUM_MAJ, { rapport });
    return { rapport };
  });

  ctx.guichet(socket, EVENEMENTS.MEDIAS_LISTER, Demandes.medias, ({ categorie }) => {
    ctx.exigerMJ(socket, "parcourir les images");
    return { fichiers: listerImages(ctx.config, categorie) };
  });

  // --- Inventaire -----------------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.INVENTAIRE_AJOUTER, Demandes.ajouterObjet, ({ idPersonnage, idObjet, quantite }) => {
    ctx.exigerMJ(socket, "distribuer des objets");
    const personnage = ctx.exigerPersonnageVisible(socket, idPersonnage);
    const entree = ctx.compendium.obtenirObjet(idObjet);
    if (!entree) throw new ErreurRegle("Objet absent du compendium (recharge-le apres une modification).");

    // Les objets empilables (potions, fleches...) rejoignent la pile existante.
    const pile = entree.empilable && personnage.inventaire.find((o) => o.source === entree.id);
    const inventaire = pile
      ? personnage.inventaire.map((o) => (o === pile ? { ...o, quantite: Math.min(QUANTITE_MAX, o.quantite + quantite) } : o))
      : [...personnage.inventaire, instancierObjet(entree, quantite)];

    return {
      personnage: ctx.publierPersonnage(
        { ...personnage, inventaire },
        { action: "objet-recu", par: pseudo, nom: entree.nom, rarete: entree.rarete, quantite },
      ),
    };
  });

  ctx.guichet(socket, EVENEMENTS.INVENTAIRE_RETIRER, Demandes.retirerObjet, ({ idPersonnage, idObjet, quantite }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const objet = personnage.inventaire.find((o) => o.id === idObjet);
    if (!objet) throw new ErreurRegle("Cet objet n'est plus dans le sac.");

    const retire = Math.min(quantite ?? objet.quantite, objet.quantite);
    const inventaire =
      retire >= objet.quantite
        ? personnage.inventaire.filter((o) => o.id !== idObjet)
        : personnage.inventaire.map((o) => (o.id === idObjet ? { ...o, quantite: o.quantite - retire } : o));

    return {
      personnage: ctx.publierPersonnage(
        { ...personnage, inventaire },
        { action: "objet-retire", par: pseudo, nom: objet.nom, quantite: retire },
      ),
    };
  });

  // --- Grimoire --------------------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.GRIMOIRE_APPRENDRE, Demandes.apprendre, ({ idPersonnage, idSort }) => {
    ctx.exigerMJ(socket, "enseigner un sort");
    const personnage = ctx.exigerPersonnageVisible(socket, idPersonnage);
    const entree = ctx.compendium.obtenirSort(idSort);
    if (!entree) throw new ErreurRegle("Sort absent du compendium (recharge-le apres une modification).");
    if (personnage.grimoire.some((s) => s.source === idSort)) {
      throw new ErreurRegle(`${personnage.nom} connait deja ${entree.nom}.`);
    }
    return {
      personnage: ctx.publierPersonnage(
        { ...personnage, grimoire: [...personnage.grimoire, instancierSort(entree)] },
        { action: "sort-appris", par: pseudo, nom: entree.nom },
      ),
    };
  });

  ctx.guichet(socket, EVENEMENTS.GRIMOIRE_OUBLIER, Demandes.oublier, ({ idPersonnage, idSort }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const sort = personnage.grimoire.find((s) => s.id === idSort);
    if (!sort) throw new ErreurRegle("Ce sort n'est plus dans le grimoire.");
    return {
      personnage: ctx.publierPersonnage(
        { ...personnage, grimoire: personnage.grimoire.filter((s) => s.id !== idSort) },
        { action: "sort-oublie", par: pseudo, nom: sort.nom },
      ),
    };
  });
}
