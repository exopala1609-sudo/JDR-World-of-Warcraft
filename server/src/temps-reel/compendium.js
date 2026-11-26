// Domaine "compendium" : la bibliotheque du MJ, et ce qui en sort
// (objets vers les sacs, sorts vers les grimoires, images de son dossier).
//
// Pourquoi une COPIE dans le sac, et pas un simple lien vers le compendium ?
// Parce qu'un objet vit sa vie : si tu corriges demain la description de
// l'epee dans le compendium, l'epee deja ramassee ne change pas en douce dans
// le sac d'un joueur. Chaque exemplaire garde "source" pour savoir d'ou il vient.
// Seule exception : l'ICONE choisie depuis le Compendium (simple apparence)
// est reportee sur les exemplaires deja en jeu a la table.
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVENEMENTS } from "../../../shared/protocole.js";
import { FICHIER_ICONES_MJ, instancierObjet, instancierSort } from "../donnees/compendium.js";
import { listerImages } from "../medias.js";
import { schemaIdCompendium } from "../modeles/compendium.js";
import { schemaId } from "../modeles/identifiants.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { ajouterAuSac, QUANTITE_MAX } from "../regles/inventaire.js";
import { SALLE_MJ } from "./index.js";

const idPersonnage = schemaId("p");

const Demandes = {
  ajouterObjet: z.strictObject({ idPersonnage, idObjet: schemaIdCompendium, quantite: z.int().min(1).max(999).default(1) }),
  retirerObjet: z.strictObject({ idPersonnage, idObjet: schemaId("o"), quantite: z.int().min(1).max(QUANTITE_MAX).optional() }),
  apprendre: z.strictObject({ idPersonnage, idSort: schemaIdCompendium }),
  oublier: z.strictObject({ idPersonnage, idSort: schemaId("s") }),
  icones: z.strictObject({ recherche: z.string().max(80).default(""), debut: z.int().min(0).max(1_000_000).default(0) }),
  medias: z.strictObject({ categorie: z.enum(["cartes", "jetons", "portraits", "icones", "sons"]) }),
  // null : revenir a l'icone ecrite dans le fichier de l'objet (ou a son id).
  icone: z.strictObject({ genre: z.enum(["objets", "sorts"]), id: schemaIdCompendium, icone: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).nullable() }),
};

const EN_TETE_ICONES = `// =============================================================================
//  MES ICONES : choisies depuis le Compendium du jeu (clic sur l'icone d'un
//  objet ou d'un sort). Elles remplacent le champ "icone" de tes autres
//  fichiers, qui ne sont jamais reecrits. Format :
//    { "objets": { "epee-longue": "INV_Sword_04" }, "sorts": { ... } }
// =============================================================================
`;

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

  // Choisir l'icone d'un objet ou d'un sort du compendium. Les exemplaires deja
  // donnes a cette table (sacs, equipement, coffres, grimoires) prennent aussi
  // la nouvelle icone : c'est une question d'apparence, pas de regles.
  ctx.guichet(socket, EVENEMENTS.COMPENDIUM_ICONE, Demandes.icone, ({ genre, id, icone }) => {
    ctx.exigerMJ(socket, "changer une icone du compendium");
    const obtenir = (cle) => (genre === "objets" ? ctx.compendium.obtenirObjet(cle) : ctx.compendium.obtenirSort(cle));
    if (!obtenir(id)) throw new ErreurRegle("Absent du compendium (recharge-le apres une modification).");

    const choix = ctx.compendium.lireChoixIcones();
    if (icone) choix[genre][id] = icone;
    else delete choix[genre][id];
    const fichier = join(ctx.compendium.dossier, FICHIER_ICONES_MJ);
    const provisoire = `${fichier}.tmp-${process.pid}`;
    writeFileSync(provisoire, `${EN_TETE_ICONES}${JSON.stringify(choix, null, 2)}\n`, "utf8");
    renameSync(provisoire, fichier);
    const rapport = ctx.compendium.charger();
    ctx.io.to(SALLE_MJ).emit(EVENEMENTS.COMPENDIUM_MAJ, { rapport });

    // Les exemplaires deja en jeu a cette table.
    const nouvelle = obtenir(id)?.icone;
    const idTable = socket.data.idTable;
    if (!idTable) return { icone: nouvelle ?? null, exemplaires: 0 };
    let exemplaires = 0;
    const retoucher = (o) => {
      if (!o || o.source !== id || o.icone === nouvelle) return o;
      exemplaires++;
      return { ...o, icone: nouvelle };
    };
    for (const p of ctx.depot.personnagesDeLaTable(idTable)) {
      const avant = exemplaires;
      const suite =
        genre === "objets"
          ? { ...p, inventaire: p.inventaire.map(retoucher), equipement: Object.fromEntries(Object.entries(p.equipement).map(([e, o]) => [e, retoucher(o)])) }
          : { ...p, grimoire: p.grimoire.map(retoucher) };
      if (exemplaires > avant) ctx.publierPersonnage(suite, { action: "icone-changee", par: pseudo });
    }
    if (genre === "objets") {
      const scene = ctx.depot.obtenirScene(idTable);
      const avant = exemplaires;
      const butins = scene.butins.map((b) => ({ ...b, objets: b.objets.map(retoucher) }));
      if (exemplaires > avant) {
        ctx.depot.enregistrerScene({ ...scene, butins });
        ctx.publierScene(idTable, { action: "icone-changee", par: pseudo });
      }
    }
    return { icone: nouvelle ?? null, exemplaires };
  });

  // Selecteur d'icones (MJ : bestiaire, compendium...). Recherche par nom de fichier.
  ctx.guichet(socket, EVENEMENTS.ICONES_CHERCHER, Demandes.icones, async ({ recherche, debut }) => {
    ctx.exigerMJ(socket, "parcourir les icones");
    if (!ctx.quota(socket, "icones", 10)) throw new ErreurRegle("Doucement : trop de recherches d'un coup.");
    return ctx.icones.chercher(recherche, undefined, debut);
  });
  ctx.guichet(socket, EVENEMENTS.ICONES_ACTUALISER, null, async () => {
    ctx.exigerMJ(socket, "parcourir les icones");
    await ctx.icones.actualiser();
    return ctx.icones.chercher("");
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
    const inventaire = ajouterAuSac(personnage.inventaire, instancierObjet(entree, quantite));

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
