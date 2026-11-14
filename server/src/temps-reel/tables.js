// Domaine "tables" : lister, creer, rejoindre une table (et son salon).
import { EVENEMENTS } from "../../../shared/protocole.js";
import { normaliserPseudo } from "../auth/sessions.js";
import { schemaId } from "../modeles/identifiants.js";
import { fabriquerTable, SchemaCreationTable } from "../modeles/table.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleTable } from "./index.js";

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

  // Renommer la table ou l'on joue (le nom au-dessus de la minicarte).
  ctx.guichet(socket, EVENEMENTS.TABLE_RENOMMER, SchemaCreationTable, ({ nom }) => {
    ctx.exigerMJ(socket, "renommer la table");
    const idTable = ctx.exigerTable(socket);
    const table = depot.enregistrerTable({ ...depot.obtenirTable(idTable), nom });
    io.to(salleTable(idTable)).emit(EVENEMENTS.TABLE_MAJ, { table });
    io.emit(EVENEMENTS.TABLES_LISTE, { tables: depot.listerTables() });
    return { table };
  });

  // Rejoindre une table : l'AIGUILLAGE de la premiere connexion.
  //  - le MJ, ou un joueur qui a deja son personnage ici : il entre en jeu ;
  //  - un joueur SANS personnage a cette table : il reste a la porte (il ne
  //    rejoint pas les salons de la table, ne voit ni la carte ni les autres)
  //    et son navigateur affiche l'ecran de creation.
  ctx.guichet(socket, EVENEMENTS.TABLE_REJOINDRE, Rejoindre, async ({ idTable }) => {
    const table = depot.obtenirTable(idTable);
    if (!table) throw new ErreurRegle("Table introuvable.");
    if (!ctx.estMJ(socket) && ctx.expulses(idTable).has(normaliserPseudo(socket.data.profil.pseudo))) {
      throw new ErreurRegle("Le Maitre du Jeu t'a expulse de cette table.");
    }
    await ctx.quitterTable(socket);

    if (!ctx.estMJ(socket) && !ctx.personnageDuJoueur(socket, idTable)) {
      socket.data.idTableCreation = idTable; // la seule table ou il pourra creer
      return { table, creationRequise: true };
    }
    return ctx.entrerDansLaTable(socket, idTable);
  });
}
