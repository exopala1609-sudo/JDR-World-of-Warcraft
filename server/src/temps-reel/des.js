// Domaine "des" : lancers libres (le serveur lance, jamais le navigateur).
import { EVENEMENTS } from "../../../shared/protocole.js";
import { z } from "../modeles/zod.js";
import { lancerDes } from "../regles/des.js";
import { jetLibre } from "../regles/resolution.js";
import { proposerJet } from "./resolution.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleMJ, salleTable } from "./index.js";

const Lancer = z.strictObject({
  formule: z.string().max(60),
  raison: z.string().trim().max(80).optional(),
  secret: z.boolean().optional(),
  // true (lanceur de des) : fenetre de resolution animee chez le joueur ET le
  // MJ, resultat annonce a "Valider". Absent (/jet) : resultat direct dans la discussion.
  fenetre: z.boolean().optional(),
});

export function brancher(socket, ctx) {
  ctx.guichet(socket, EVENEMENTS.DES_LANCER, Lancer, ({ formule, raison, secret, fenetre }) => {
    const idTable = ctx.exigerTable(socket);
    if (secret && !ctx.estMJ(socket)) throw new ErreurRegle("Seul le MJ peut lancer en secret.");
    if (fenetre) {
      return { jet: proposerJet(ctx, socket, null, { ...jetLibre(formule, raison), cout: null }, { secret: Boolean(secret) }) };
    }

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
