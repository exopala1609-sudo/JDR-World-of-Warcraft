// Domaine "equipement" : equiper / desequiper, barre d'actions, utiliser un objet.
//
// Toujours la meme regle : le navigateur DEMANDE ("mets cette epee dans la
// main droite"), le serveur verifie (l'objet est-il dans CE sac ? va-t-il a
// cet emplacement ?), applique, recalcule la classe d'armure, enregistre et
// diffuse la fiche a jour. Un joueur ne touche qu'a son propre personnage.
import { attaquesEquipees, exemplairesDuRaccourci, IDS_EMPLACEMENTS, objetRaccourcissable, TAILLE_BARRE } from "../../../shared/equipement.js";
import { EVENEMENTS, TYPES_PV } from "../../../shared/protocole.js";
import { schemaId } from "../modeles/identifiants.js";
import { SchemaRaccourci } from "../modeles/personnage.js";
import { z } from "../modeles/zod.js";
import { lancerDes } from "../regles/des.js";
import { desequiper, equiper, recalculerClasseArmure } from "../regles/equipement.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { sortirUn } from "../regles/inventaire.js";
import { appliquerPointsDeVie, texteDeCombat } from "../regles/points-de-vie.js";
import { jetArme } from "../regles/resolution.js";
import { proposerJet, sortDuGrimoire } from "./resolution.js";

const idPersonnage = schemaId("p");
const emplacement = z.enum(IDS_EMPLACEMENTS, "Emplacement inconnu.");
const Demandes = {
  equiper: z.strictObject({ idPersonnage, idObjet: schemaId("o"), emplacement: emplacement.optional() }),
  desequiper: z.strictObject({ idPersonnage, emplacement }),
  barre: z.strictObject({ idPersonnage, index: z.int().min(0).max(TAILLE_BARRE - 1), raccourci: SchemaRaccourci.nullable() }),
  utiliser: z.strictObject({ idPersonnage, reference: z.string().min(1).max(80) }),
};

export function brancher(socket, ctx) {
  const pseudo = socket.data.profil.pseudo;

  /** Enregistre la fiche apres un changement d'equipement : CA recalculee, diffusion. */
  function publierEquipement(fiche, cause) {
    const classe = ctx.referentiel.obtenirClasse(fiche.classe);
    return ctx.publierPersonnage(recalculerClasseArmure(fiche, classe), { par: pseudo, ...cause });
  }

  ctx.guichet(socket, EVENEMENTS.EQUIPER, Demandes.equiper, ({ idPersonnage, idObjet, emplacement }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const { fiche, detail } = equiper(personnage, idObjet, emplacement);
    return { personnage: publierEquipement(fiche, { action: "equipe", ...detail, classeArmure: personnage.classeArmure }) };
  });

  ctx.guichet(socket, EVENEMENTS.DESEQUIPER, Demandes.desequiper, ({ idPersonnage, emplacement }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const { fiche, detail } = desequiper(personnage, emplacement);
    return { personnage: publierEquipement(fiche, { action: "desequipe", ...detail, classeArmure: personnage.classeArmure }) };
  });

  // --- Barre d'actions ------------------------------------------------------------
  // Les raccourcis sont enregistres DANS la fiche : on les retrouve sur
  // n'importe quel ordinateur, et apres un F5.
  ctx.guichet(socket, EVENEMENTS.BARRE_DEFINIR, Demandes.barre, ({ idPersonnage, index, raccourci }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    if (raccourci?.type === "sort") {
      if (!sortDuGrimoire(personnage, raccourci.reference)) throw new ErreurRegle("Ce sort n'est pas dans le grimoire.");
    } else if (raccourci?.type === "attaque") {
      if (!personnage.attaquesMonstre.some((a) => a.nom === raccourci.reference)) throw new ErreurRegle("Cette attaque n'existe pas.");
    } else if (raccourci) {
      const { dansLeSac, equipes } = exemplairesDuRaccourci(personnage, raccourci.reference);
      const objet = dansLeSac[0] ?? equipes[0]?.[1];
      if (!objet) throw new ErreurRegle("Cet objet n'est ni dans le sac ni sur le personnage.");
      if (!objetRaccourcissable(objet)) throw new ErreurRegle(`${objet.nom} ne s'utilise pas depuis la barre d'actions.`);
    }
    const barreActions = personnage.barreActions.map((r, i) => (i === index ? raccourci : r));
    return { personnage: ctx.publierPersonnage({ ...personnage, barreActions }, { action: "barre", par: pseudo }) };
  });

  // --- Utiliser un objet (clic sur la barre d'actions, ou clic droit dans le sac) ---
  ctx.guichet(socket, EVENEMENTS.OBJET_UTILISER, Demandes.utiliser, ({ idPersonnage, reference }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const { dansLeSac, equipes } = exemplairesDuRaccourci(personnage, reference);

    // 1. Un objet qui soigne (potion) : on le boit, il disparait du sac.
    const potion = dansLeSac.find((o) => o.soins);
    if (potion) {
      const { inventaire } = sortirUn(personnage.inventaire, potion.id);
      const jet = lancerDes(potion.soins);
      const { pointsDeVie, detail } = appliquerPointsDeVie(personnage.pointsDeVie, TYPES_PV.SOINS, Math.max(0, jet.total));
      const publie = ctx.publierPersonnage(
        { ...personnage, inventaire, pointsDeVie },
        { action: "objet-utilise", par: pseudo, nom: potion.nom, soins: detail.variation, jet: jet.total },
      );
      ctx.publierTexteCombat(personnage, texteDeCombat(detail));
      return { personnage: publie };
    }

    // 2. Une arme EQUIPEE : la fenetre de resolution s'ouvre (jet d'attaque detaille, degats).
    const arme = attaquesEquipees(personnage).find((a) => equipes.some(([, o]) => o.id === a.idObjet));
    if (arme) {
      const objet = equipes.find(([, o]) => o.id === arme.idObjet)[1];
      ctx.publierPersonnage({ ...personnage, repose: false }, { action: "attaque", par: pseudo, nom: objet.nom });
      return { jet: proposerJet(ctx, socket, personnage, { ...jetArme(personnage, arme, objet), cout: null }) };
    }

    const objet = dansLeSac[0] ?? equipes[0]?.[1];
    if (objet?.arme) throw new ErreurRegle(`Equipe d'abord ${objet.nom} pour attaquer avec.`);
    if (!objet) throw new ErreurRegle("Tu n'as plus cet objet.");
    throw new ErreurRegle(`${objet.nom} ne s'utilise pas.`);
  });
}

