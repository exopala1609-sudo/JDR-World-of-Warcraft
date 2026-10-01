// Domaine "chat" : la fenetre de discussion facon WoW.
//
// Trois canaux :
//   - "dire"    (/s, ou texte simple) : le personnage parle, en jeu (blanc) ;
//   - "groupe"  (/g)                  : hors jeu, entre joueurs (bleu clair) ;
//   - "murmure" (/w Pseudo message)   : prive, entre DEUX personnes (rose).
// "dire" et "groupe" vont a toute la table (MJ compris : a une table de jeu,
// le MJ entend tout). Un murmure, lui, n'est envoye qu'aux sockets (onglets)
// de l'expediteur et du destinataire, designes un par un par leur identifiant :
// il ne passe JAMAIS par le salon de la table, les autres ne le recoivent pas.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { normaliserPseudo } from "../auth/sessions.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleTable } from "./index.js";

const Envoyer = z.strictObject({
  canal: z.enum(["dire", "groupe", "murmure"]),
  texte: z.string().trim().min(1, "Message vide.").max(500, "Message trop long (500 caracteres maximum)."),
  destinataire: z.string().trim().min(1).max(40).optional(), // pour un murmure
});

// "/w MJ ..." : raccourci pour murmurer au MJ, quel que soit son pseudo.
const ALIAS_MJ = new Set(["mj", "gm", "maitre du jeu", "maître du jeu"]);

export function brancher(socket, ctx) {
  const { io } = ctx;
  const { pseudo } = socket.data.profil;

  ctx.guichet(socket, EVENEMENTS.CHAT_ENVOYER, Envoyer, async ({ canal, texte, destinataire }) => {
    const idTable = ctx.exigerTable(socket);
    if (!ctx.quota(socket, "chat", 5)) throw new ErreurRegle("Doucement : 5 messages par seconde au plus.");
    const message = { canal, de: pseudo, texte, horodatage: new Date().toISOString() };

    if (canal !== "murmure") {
      // "Dire" : en jeu, au nom du personnage ("Garrosh dit : ..."). "Groupe" :
      // hors jeu, au nom du joueur ("[Groupe] [Thrall] : ..."). Le MJ parle en son nom.
      const personnage = ctx.estMJ(socket) || canal === "groupe" ? null : ctx.personnageDuJoueur(socket, idTable);
      io.to(salleTable(idTable)).emit(EVENEMENTS.CHAT_MESSAGE, { ...message, nom: personnage?.nom ?? pseudo });
      return {};
    }

    if (!destinataire) throw new ErreurRegle("A qui ? Ecris : /w Pseudo message");
    // Les navigateurs connectes a CETTE table, et parmi eux ceux du destinataire.
    const presents = await io.in(salleTable(idTable)).fetchSockets();
    const cible = normaliserPseudo(destinataire);
    const versMJ = ALIAS_MJ.has(cible);
    const destinataires = presents.filter((s) =>
      versMJ ? s.data.profil.role === "mj" : normaliserPseudo(s.data.profil.pseudo) === cible,
    );
    if (destinataires.length === 0) throw new ErreurRegle(`${destinataire} n'est pas connecte a cette table.`);
    const vers = destinataires[0].data.profil.pseudo;
    if (normaliserPseudo(vers) === normaliserPseudo(pseudo)) throw new ErreurRegle("Tu te murmures a toi-meme ?");

    // Envoi CIBLE : socket par socket (le destinataire, puis les autres onglets
    // de l'expediteur pour qu'il voie "A Jaina : ..."). Personne d'autre.
    const expediteur = presents.filter((s) => normaliserPseudo(s.data.profil.pseudo) === normaliserPseudo(pseudo));
    const murmure = { ...message, nom: pseudo, vers };
    for (const s of destinataires) {
      io.to(s.id).emit(EVENEMENTS.CHAT_MESSAGE, murmure);
      io.to(s.id).emit(EVENEMENTS.SON_JOUER, { son: "murmure" }); // le "tintement" du MP
    }
    for (const s of expediteur) io.to(s.id).emit(EVENEMENTS.CHAT_MESSAGE, murmure);
    return {};
  });
}
