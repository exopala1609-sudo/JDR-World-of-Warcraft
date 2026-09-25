// Domaine "tables" : lister, creer, rejoindre une table (et son salon).
import { EVENEMENTS } from "../../../shared/protocole.js";
import { schemaId } from "../modeles/identifiants.js";
import { fabriquerTable } from "../modeles/table.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleJoueurs, salleMJ, salleTable } from "./index.js";

const Rejoindre = z.strictObject({ idTable: schemaId("t") });

export function brancher(socket, ctx) {
  const { depot, io } = ctx;

  ctx.guichet(socket, EVENEMENTS.TABLES_LISTER, null, () => ({ tables: depot.listerTables() }));

  ctx.guichet(socket, EVENEMENTS.TABLE_CREER, null, (donnees) => {
    ctx.exigerMJ(socket, "creer une table");
    const table = depot.enregistrerTable(fabriquerTable(donnees));
    io.emit(EVENEMENTS.TABLES_LISTE, { tables: depot.listerTables() });
    console.log(`[temps-reel] Table creee : ${table.nom} (${table.id}).`);
    return { table };
  });

  ctx.guichet(socket, EVENEMENTS.TABLE_REJOINDRE, Rejoindre, async ({ idTable }) => {
    const table = depot.obtenirTable(idTable);
    if (!table) throw new ErreurRegle("Table introuvable.");

    // On quitte l'eventuelle table precedente avant d'entrer dans la nouvelle.
    const ancienne = socket.data.idTable;
    if (ancienne && ancienne !== idTable) {
      socket.leave(salleTable(ancienne));
      socket.leave(salleMJ(ancienne));
      socket.leave(salleJoueurs(ancienne));
      await ctx.diffuserPresence(ancienne);
    }

    socket.data.idTable = idTable;
    socket.join(salleTable(idTable));
    socket.join(ctx.estMJ(socket) ? salleMJ(idTable) : salleJoueurs(idTable));
    await ctx.diffuserPresence(idTable);

    // L'arrivant recoit une photo complete de ce qu'il a le droit de voir.
    return {
      table,
      personnages: ctx.personnagesVisibles(socket, idTable),
      combat: depot.obtenirCombat(idTable),
      scene: ctx.vueDeLaScene(depot.obtenirScene(idTable), ctx.estMJ(socket)),
      traces: ctx.traces.get(idTable) ?? [],
    };
  });
}
