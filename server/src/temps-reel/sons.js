// Domaine "sons" : le MJ fait jouer un son a toute la table (soundboard).
// Les sons automatiques (murmure recu, quete, debut de combat) sont emis
// directement par les domaines concernes (chat.js, quetes.js, combat.js).
//
// Le serveur n'envoie qu'un NOM de son ("combat") : chaque navigateur le lit
// dans le dossier sons/ du cloud (/medias/sons/combat.ogg ou .mp3...). Rien
// de lourd ne circule dans le tuyau temps reel.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleTable } from "./index.js";

const Diffuser = z.strictObject({
  son: z.string().regex(/^[a-z0-9-]{1,40}$/, "Nom de son : minuscules, chiffres et tirets (sans extension)."),
});

/** Fait jouer un son a toute une table. */
export const jouerSon = (ctx, idTable, son) => ctx.io.to(salleTable(idTable)).emit(EVENEMENTS.SON_JOUER, { son });

export function brancher(socket, ctx) {
  ctx.guichet(socket, EVENEMENTS.SON_DIFFUSER, Diffuser, ({ son }) => {
    ctx.exigerMJ(socket, "faire jouer un son");
    if (!ctx.quota(socket, "son", 3)) throw new ErreurRegle("Un son a la fois !");
    jouerSon(ctx, ctx.exigerTable(socket), son);
    return {};
  });
}
