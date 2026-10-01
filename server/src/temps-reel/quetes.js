// Domaine "quetes" : le journal de quetes du groupe (touche L).
// Le MJ "pousse" une quete ; elle apparait aussitot dans le journal de tous
// les joueurs connectes (et de ceux qui arriveront ensuite). Lecture seule
// pour les joueurs : seul le MJ ajoute, termine ou retire une quete.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { nouvelId, schemaId } from "../modeles/identifiants.js";
import { STATUTS_QUETE } from "../modeles/quete.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleTable } from "./index.js";
import { jouerSon } from "./sons.js";

const Demandes = {
  ajouter: z.strictObject({
    titre: z.string().trim().min(1, "La quete doit avoir un titre.").max(80),
    objectif: z.string().trim().min(1, "Indique l'objectif de la quete.").max(500),
    description: z.string().trim().max(4000).optional(),
  }),
  modifier: z.strictObject({ idQuete: schemaId("q"), statut: z.enum(STATUTS_QUETE) }),
  supprimer: z.strictObject({ idQuete: schemaId("q") }),
};

export function brancher(socket, ctx) {
  const { depot, io } = ctx;
  const pseudo = socket.data.profil.pseudo;

  function publier(idTable, quetes, cause) {
    io.to(salleTable(idTable)).emit(EVENEMENTS.QUETES_ETAT, { quetes, cause });
    // Le son de WoW : "quete acceptee" a l'ajout, la fanfare a la fin.
    if (cause.action === "nouvelle") jouerSon(ctx, idTable, "quete-nouvelle");
    if (cause.action === "terminee") jouerSon(ctx, idTable, "quete-terminee");
  }
  function exigerQuete(idTable, idQuete) {
    const quete = depot.obtenirQuetes(idTable).find((q) => q.id === idQuete);
    if (!quete) throw new ErreurRegle("Cette quete n'existe plus.");
    return quete;
  }

  ctx.guichet(socket, EVENEMENTS.QUETE_AJOUTER, Demandes.ajouter, ({ titre, objectif, description }) => {
    ctx.exigerMJ(socket, "donner une quete");
    const idTable = ctx.exigerTable(socket);
    const quete = { id: nouvelId("q"), titre, objectif, description: description ?? "", statut: "en-cours", creeLe: new Date().toISOString() };
    const quetes = depot.enregistrerQuetes(idTable, [...depot.obtenirQuetes(idTable), quete]);
    publier(idTable, quetes, { action: "nouvelle", titre, par: pseudo });
    return { quete };
  });

  ctx.guichet(socket, EVENEMENTS.QUETE_MODIFIER, Demandes.modifier, ({ idQuete, statut }) => {
    ctx.exigerMJ(socket, "modifier une quete");
    const idTable = ctx.exigerTable(socket);
    const quete = exigerQuete(idTable, idQuete);
    const quetes = depot.enregistrerQuetes(
      idTable,
      depot.obtenirQuetes(idTable).map((q) => (q.id === idQuete ? { ...q, statut } : q)),
    );
    publier(idTable, quetes, { action: statut, titre: quete.titre, par: pseudo });
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.QUETE_SUPPRIMER, Demandes.supprimer, ({ idQuete }) => {
    ctx.exigerMJ(socket, "retirer une quete");
    const idTable = ctx.exigerTable(socket);
    const quete = exigerQuete(idTable, idQuete);
    const quetes = depot.enregistrerQuetes(idTable, depot.obtenirQuetes(idTable).filter((q) => q.id !== idQuete));
    publier(idTable, quetes, { action: "retiree", titre: quete.titre, par: pseudo });
    return {};
  });
}
