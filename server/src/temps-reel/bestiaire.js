// Domaine "bestiaire" : le MJ glisse un monstre de son Bestiaire sur la carte.
// Le serveur fabrique la fiche du PNJ d'apres le modele du compendium (PV
// tires au de si le modele donne une formule), lui met son butin dans le sac
// (on le trouvera sur son cadavre), et pose son pion la ou il a ete lache.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { instancierObjet } from "../donnees/compendium.js";
import { schemaIdCompendium } from "../modeles/compendium.js";
import { fabriquerMonstre } from "../modeles/personnage.js";
import { z } from "../modeles/zod.js";
import { lancerDes } from "../regles/des.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { placerPion, positionValide } from "../regles/scene.js";

const coordonnee = z.number().finite().min(-100_000).max(100_000);
const Invoquer = z.strictObject({
  idMonstre: schemaIdCompendium,
  x: coordonnee,
  y: coordonnee,
  cache: z.boolean().default(true), // par defaut, les joueurs ne le voient pas encore
});

/** "Gnoll", puis "Gnoll 2", "Gnoll 3"... : chaque monstre a un nom distinct. */
export function nomDisponible(base, nomsPris) {
  const pris = new Set(nomsPris.map((n) => n.toLocaleLowerCase("fr")));
  if (!pris.has(base.toLocaleLowerCase("fr"))) return base;
  for (let n = 2; ; n++) if (!pris.has(`${base} ${n}`.toLocaleLowerCase("fr"))) return `${base} ${n}`;
}

export function brancher(socket, ctx) {
  const { depot, compendium } = ctx;
  const pseudo = socket.data.profil.pseudo;

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
