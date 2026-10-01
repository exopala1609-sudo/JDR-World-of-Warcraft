// Domaine "bestiaire" : le MJ glisse un monstre de son Bestiaire sur la carte.
// Le serveur fabrique la fiche du PNJ d'apres le modele du compendium (PV
// tires au de si le modele donne une formule), lui met son butin dans le sac
// (on le trouvera sur son cadavre), et pose son pion la ou il a ete lache.
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVENEMENTS } from "../../../shared/protocole.js";
import { FICHIER_MONSTRES_MJ } from "../donnees/compendium.js";
import { lireJsonCommente } from "../fichiers.js";
import { instancierObjet } from "../donnees/compendium.js";
import { SchemaEntreeMonstre, schemaIdCompendium } from "../modeles/compendium.js";
import { fabriquerMonstre } from "../modeles/personnage.js";
import { z } from "../modeles/zod.js";
import { lancerDes } from "../regles/des.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { placerPion, positionValide } from "../regles/scene.js";
import { SALLE_MJ } from "./index.js";

const coordonnee = z.number().finite().min(-100_000).max(100_000);
const Invoquer = z.strictObject({
  idMonstre: schemaIdCompendium,
  x: coordonnee,
  y: coordonnee,
  cache: z.boolean().default(true), // par defaut, les joueurs ne le voient pas encore
});

const EnTete = `// =============================================================================
//  MES MONSTRES : crees depuis le Bestiaire du jeu (bouton "Nouveau monstre").
// =============================================================================
//  Ce fichier est ecrit par le jeu, mais tu peux aussi le modifier au
//  Bloc-notes (meme format que exemple-bestiaire.json, voir docs/COMPENDIUM.md).
//  Apres une modification a la main : bouton "Recharger" du MJ.
// =============================================================================
`;

/** "Ogre des collines" -> "ogre-des-collines" (l'identifiant technique). */
export function identifiantDepuisNom(nom) {
  return (
    String(nom)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "monstre"
  );
}

/** "Gnoll", puis "Gnoll 2", "Gnoll 3"... : chaque monstre a un nom distinct. */
export function nomDisponible(base, nomsPris) {
  const pris = new Set(nomsPris.map((n) => n.toLocaleLowerCase("fr")));
  if (!pris.has(base.toLocaleLowerCase("fr"))) return base;
  for (let n = 2; ; n++) if (!pris.has(`${base} ${n}`.toLocaleLowerCase("fr"))) return `${base} ${n}`;
}

const Enregistrer = z.strictObject({
  monstre: z.record(z.string(), z.unknown()), // verifie ensuite par le schema du compendium
  remplace: schemaIdCompendium.optional(), // modification : l'identifiant d'origine
});
const Supprimer = z.strictObject({ idMonstre: schemaIdCompendium });

export function brancher(socket, ctx) {
  const { depot, compendium } = ctx;
  const pseudo = socket.data.profil.pseudo;
  const chemin = () => join(compendium.dossier, FICHIER_MONSTRES_MJ);

  /** Les monstres deja ecrits dans mes-monstres.json (tels quels, meme mal ecrits). */
  function lireMesMonstres() {
    if (!existsSync(chemin())) return [];
    const contenu = lireJsonCommente(chemin());
    return Array.isArray(contenu?.monstres) ? contenu.monstres : [];
  }
  /** Ecriture sure (fichier temporaire puis renommage), avec son mode d'emploi en tete. */
  function ecrireMesMonstres(liste) {
    const provisoire = `${chemin()}.tmp-${process.pid}`;
    writeFileSync(provisoire, `${EnTete}${JSON.stringify({ monstres: liste }, null, 2)}\n`, "utf8");
    renameSync(provisoire, chemin());
  }
  function recharger() {
    const rapport = compendium.charger();
    ctx.io.to(SALLE_MJ).emit(EVENEMENTS.COMPENDIUM_MAJ, { rapport });
  }

  // Creer (ou modifier) un monstre depuis le formulaire du Bestiaire.
  ctx.guichet(socket, EVENEMENTS.BESTIAIRE_ENREGISTRER, Enregistrer, ({ monstre, remplace }) => {
    ctx.exigerMJ(socket, "modifier le bestiaire");
    const brut = { ...monstre, id: monstre.id || identifiantDepuisNom(monstre.nom ?? "") };
    const resultat = SchemaEntreeMonstre.safeParse(brut);
    if (!resultat.success) {
      throw new ErreurRegle(resultat.error.issues.map((i) => `${i.path.join(".") || "monstre"} : ${i.message}`).join(" ; "));
    }
    const entree = resultat.data;
    const ailleurs = compendium.fichierDuMonstre(entree.id);
    if (ailleurs && ailleurs !== FICHIER_MONSTRES_MJ) {
      throw new ErreurRegle(`L'identifiant "${entree.id}" est deja pris par ${ailleurs} : choisis un autre nom.`);
    }
    const liste = lireMesMonstres().filter((m) => m?.id !== entree.id && m?.id !== remplace);
    ecrireMesMonstres([...liste, entree]);
    recharger();
    return { monstre: entree };
  });

  ctx.guichet(socket, EVENEMENTS.BESTIAIRE_SUPPRIMER, Supprimer, ({ idMonstre }) => {
    ctx.exigerMJ(socket, "modifier le bestiaire");
    if (compendium.fichierDuMonstre(idMonstre) !== FICHIER_MONSTRES_MJ) {
      throw new ErreurRegle("Seuls les monstres crees depuis le jeu se suppriment ici (les autres : dans leur fichier).");
    }
    ecrireMesMonstres(lireMesMonstres().filter((m) => m?.id !== idMonstre));
    recharger();
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.BESTIAIRE_INVOQUER, Invoquer, ({ idMonstre, x, y, cache }) => {
    ctx.exigerMJ(socket, "invoquer un monstre");
    const idTable = ctx.exigerTable(socket);
    const modele = compendium.obtenirMonstre(idMonstre);
    if (!modele) throw new ErreurRegle("Ce monstre n'est plus dans le bestiaire (recharge le compendium ?).");

    const pv = typeof modele.pv === "number" ? modele.pv : lancerDes(modele.pv).total;
    const nom = nomDisponible(modele.nom, depot.personnagesDeLaTable(idTable).map((p) => p.nom));
    let fiche = fabriquerMonstre(modele, { idTable, nom, pv });
    const butin = modele.butin.map(({ id, quantite }) => compendium.obtenirObjet(id) && instancierObjet(compendium.obtenirObjet(id), quantite)).filter(Boolean);
    if (butin.length) fiche = { ...fiche, inventaire: butin };
    const personnage = ctx.publierPersonnage(fiche, { action: "invocation", par: pseudo, cache }); // PNJ : au MJ seul

    const scene = depot.obtenirScene(idTable);
    const position = positionValide(scene, x, y);
    depot.enregistrerScene(placerPion(scene, personnage, position, { cache }).scene);
    ctx.publierScene(idTable, { action: "pion-place", par: pseudo, nom });
    return { personnage };
  });
}
