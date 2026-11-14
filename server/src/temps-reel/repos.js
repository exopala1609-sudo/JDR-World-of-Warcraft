// Domaine "repos" : repos court (par personnage) et repos long (MJ).
//
// Qui decide ?
//  - Repos court : le joueur choisit combien de des de vie il depense, pour
//    SON personnage (le MJ peut aussi le faire pour n'importe qui).
//  - Repos long : c'est le MJ qui accorde une nuit de repos, a un personnage
//    ou a toute la table d'un coup.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { schemaId } from "../modeles/identifiants.js";
import { z } from "../modeles/zod.js";
import { texteDeCombat } from "../regles/points-de-vie.js";
import { reposCourt, reposLong } from "../regles/repos.js";

const Court = z.strictObject({ idPersonnage: schemaId("p"), desDeVie: z.int().min(0).max(20) });
const Long = z.strictObject({ idPersonnage: schemaId("p").optional() }); // absent = toute la table

export function brancher(socket, ctx) {
  const pseudo = socket.data.profil.pseudo;

  ctx.guichet(socket, EVENEMENTS.REPOS_COURT, Court, ({ idPersonnage, desDeVie }) => {
    const personnage = ctx.exigerPersonnageModifiable(socket, idPersonnage);
    const { personnage: repose, detail } = reposCourt(personnage, desDeVie);
    const publie = ctx.publierPersonnage(repose, { action: "repos", par: pseudo, ...detail });
    ctx.publierTexteCombat(repose, texteDeCombat(detail)); // les PV recuperes, en vert
    return { personnage: publie };
  });

  ctx.guichet(socket, EVENEMENTS.REPOS_LONG, Long, ({ idPersonnage }) => {
    ctx.exigerMJ(socket, "accorder un repos long");
    const idTable = ctx.exigerTable(socket);
    const cibles = idPersonnage
      ? [ctx.exigerPersonnageVisible(socket, idPersonnage)]
      : ctx.depot.personnagesDeLaTable(idTable);

    const personnages = cibles.map((personnage) => {
      const { personnage: repose, detail } = reposLong(personnage);
      const publie = ctx.publierPersonnage(repose, { action: "repos", par: pseudo, ...detail });
      ctx.publierTexteCombat(repose, texteDeCombat(detail));
      return publie;
    });
    return { personnages };
  });
}
