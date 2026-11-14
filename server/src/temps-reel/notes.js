// Domaine "notes" : le carnet de notes PRIVE de chacun (touche N).
// Le carnet d'un participant n'est envoye qu'a LUI : en reponse a sa demande,
// et a ses autres onglets ouverts (salon prive du joueur ; salon MJ pour le MJ).
// Personne d'autre ne le recoit, pas meme le MJ pour les notes d'un joueur.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { normaliserPseudo } from "../auth/sessions.js";
import { nouvelId, schemaId } from "../modeles/identifiants.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleDuJoueur, salleMJ } from "./index.js";

const Demandes = {
  enregistrer: z.strictObject({
    idNote: schemaId("n").optional(), // absent = nouvelle note
    titre: z.string().trim().min(1, "Donne un titre a ta note.").max(80),
    texte: z.string().max(10_000).default(""),
  }),
  supprimer: z.strictObject({ idNote: schemaId("n") }),
};

export function brancher(socket, ctx) {
  const { depot, io } = ctx;
  const auteur = () => (ctx.estMJ(socket) ? "mj" : `joueur:${normaliserPseudo(socket.data.profil.pseudo)}`);
  const sallePrivee = (idTable) => (ctx.estMJ(socket) ? salleMJ(idTable) : salleDuJoueur(idTable, socket.data.profil.pseudo));

  function publier(idTable, notes) {
    socket.to(sallePrivee(idTable)).emit(EVENEMENTS.NOTES_ETAT, { notes }); // ses autres onglets
    return { notes };
  }

  ctx.guichet(socket, EVENEMENTS.NOTES_LIRE, null, () => ({ notes: depot.obtenirNotes(ctx.exigerTable(socket), auteur()) }));

  ctx.guichet(socket, EVENEMENTS.NOTE_ENREGISTRER, Demandes.enregistrer, ({ idNote, titre, texte }) => {
    const idTable = ctx.exigerTable(socket);
    if (!ctx.quota(socket, "notes", 5)) throw new ErreurRegle("Doucement : trop d'enregistrements d'un coup.");
    const notes = depot.obtenirNotes(idTable, auteur());
    if (idNote && !notes.some((n) => n.id === idNote)) throw new ErreurRegle("Cette note n'existe plus.");
    const note = { id: idNote ?? nouvelId("n"), titre, texte, modifieLe: new Date().toISOString() };
    const liste = idNote ? notes.map((n) => (n.id === idNote ? note : n)) : [note, ...notes];
    return { ...publier(idTable, depot.enregistrerNotes(idTable, auteur(), liste)), note };
  });

  ctx.guichet(socket, EVENEMENTS.NOTE_SUPPRIMER, Demandes.supprimer, ({ idNote }) => {
    const idTable = ctx.exigerTable(socket);
    const notes = depot.obtenirNotes(idTable, auteur());
    return publier(idTable, depot.enregistrerNotes(idTable, auteur(), notes.filter((n) => n.id !== idNote)));
  });
}
