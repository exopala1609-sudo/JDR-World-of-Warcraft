// Domaine "des" : lancers libres (le serveur lance, jamais le navigateur).
import { EVENEMENTS } from "../../../shared/protocole.js";
import { z } from "../modeles/zod.js";
import { lancerDes } from "../regles/des.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleMJ, salleTable } from "./index.js";

const Lancer = z.strictObject({
  formule: z.string().max(60),
  raison: z.string().trim().max(80).optional(),
  secret: z.boolean().optional(),
});

export function brancher(socket, ctx) {
  ctx.guichet(socket, EVENEMENTS.DES_LANCER, Lancer, ({ formule, raison, secret }) => {
    const idTable = ctx.exigerTable(socket);
    if (secret && !ctx.estMJ(socket)) throw new ErreurRegle("Seul le MJ peut lancer en secret.");

    const resultat = {
      ...lancerDes(formule),
      raison: raison || null,
      par: socket.data.profil.pseudo,
      secret: Boolean(secret),
      horodatage: new Date().toISOString(),
    };
    ctx.io.to(secret ? salleMJ(idTable) : salleTable(idTable)).emit(EVENEMENTS.DES_RESULTAT, resultat);
    return { resultat };
  });
}
