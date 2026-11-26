// Domaine "tactique" : ce que joueurs ET MJ dessinent sur la carte pour se
// coordonner. Deux outils :
//
//  - le PING : un clic, et un cercle s'agrandit puis disparait chez tout le
//    monde ("regardez ici !"). Rien n'est enregistre.
//  - le TRACE : une ligne a main levee (un chemin, une fleche d'attaque).
//    Comme pour le brouillard, le trace part par morceaux toutes les 50 ms :
//    les autres le voient se dessiner en direct. Les traces restent en
//    memoire jusqu'a ce qu'on les efface (ou que le MJ change de carte).
//
// Securite : le serveur colle lui-meme le nom de l'auteur sur chaque trace,
// borne les points a la carte et limite la cadence. Un joueur ne peut ni
// effacer les traces des autres, ni inonder la table de pings.
import { couleurDe } from "../../../shared/couleurs.js";
import { borner } from "../../../shared/geometrie.js";
import { EVENEMENTS } from "../../../shared/protocole.js";
import { z } from "../modeles/zod.js";
import { effacerTraces, LIMITES_DESSIN, prolongerTrace } from "../regles/dessins.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleTable } from "./index.js";

const PINGS_PAR_SECONDE = 3; // l'interface en permet un toutes les 0,4 s
const MORCEAUX_PAR_SECONDE = 40; // un morceau de trace part toutes les 50 ms (20 par seconde)

const coordonnee = z.number().min(-100_000).max(100_000);
const Demandes = {
  ping: z.strictObject({ x: coordonnee, y: coordonnee }),
  trait: z.strictObject({
    cle: z.string().regex(/^[a-z0-9]{4,20}$/), // choisie par le navigateur, unique pour LUI
    couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRVVBB."),
    points: z.array(z.tuple([coordonnee, coordonnee])).min(1).max(LIMITES_DESSIN.pointsParMorceau),
  }),
  effacer: z.strictObject({ tout: z.boolean().default(false) }),
};

export function brancher(socket, ctx) {
  const { io, depot } = ctx;
  const profil = socket.data.profil;

  ctx.guichet(socket, EVENEMENTS.CARTE_PING, Demandes.ping, ({ x, y }) => {
    const idTable = ctx.exigerTable(socket);
    if (!ctx.quota(socket, "ping", PINGS_PAR_SECONDE)) throw new ErreurRegle("Doucement avec les pings !");
    const point = borner(x, y, depot.obtenirScene(idTable).carte);
    // Celui qui pingue l'a deja dessine chez lui : on previent les AUTRES.
    socket.to(salleTable(idTable)).emit(EVENEMENTS.CARTE_PING_RECU, { ...point, couleur: couleurDe(profil), par: profil.pseudo });
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.DESSIN_TRAIT, Demandes.trait, ({ cle, couleur, points }) => {
    const idTable = ctx.exigerTable(socket);
    if (!ctx.quota(socket, "trace", MORCEAUX_PAR_SECONDE)) throw new ErreurRegle("Trace envoye trop vite.");
    const { traces, trace, morceau } = prolongerTrace(
      ctx.traces.get(idTable) ?? [],
      { auteur: profil.pseudo, cle, couleur, points },
      depot.obtenirScene(idTable).carte,
    );
    ctx.traces.set(idTable, traces);
    socket.to(salleTable(idTable)).emit(EVENEMENTS.DESSIN_AJOUTE, {
      id: trace.id,
      auteur: trace.auteur,
      couleur: trace.couleur,
      points: morceau,
    });
    return { id: trace.id };
  });

  ctx.guichet(socket, EVENEMENTS.DESSIN_EFFACER, Demandes.effacer, ({ tout }) => {
    const idTable = ctx.exigerTable(socket);
    if (tout) ctx.exigerMJ(socket, "effacer les traces des autres");
    const traces = effacerTraces(ctx.traces.get(idTable) ?? [], tout ? null : profil.pseudo);
    ctx.traces.set(idTable, traces);
    io.to(salleTable(idTable)).emit(EVENEMENTS.DESSINS_ETAT, { traces, par: profil.pseudo });
    return {};
  });
}
