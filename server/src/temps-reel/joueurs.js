// Domaine "joueurs" : le MJ expulse (ou readmet) un joueur.
//
// Expulser = trois verrous :
//   1. ses navigateurs sont deconnectes sur-le-champ (apres un message) ;
//   2. ses jetons d'acces sont annules : il ne peut pas se reconnecter en douce ;
//   3. la table lui est fermee : meme en se reconnectant (nouveau jeton), il
//      ne peut plus la rejoindre tant que le MJ ne l'a pas readmis.
// La liste des expulses vit en memoire : un redemarrage du serveur l'efface.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { normaliserPseudo } from "../auth/sessions.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { salleTable } from "./index.js";

const Cibler = z.strictObject({ pseudo: z.string().trim().min(1).max(40) });

export function brancher(socket, ctx) {
  const { io } = ctx;

  ctx.guichet(socket, EVENEMENTS.JOUEUR_EXPULSER, Cibler, async ({ pseudo }) => {
    ctx.exigerMJ(socket, "expulser un joueur");
    const idTable = ctx.exigerTable(socket);
    const cible = normaliserPseudo(pseudo);
    if (!ctx.depot.personnagesDeLaTable(idTable).some((p) => p.proprietaire && normaliserPseudo(p.proprietaire) === cible)) {
      throw new ErreurRegle(`${pseudo} n'a pas de personnage a cette table.`);
    }
    ctx.expulses(idTable).add(cible);
    ctx.sessions.revoquerPseudo(pseudo);
    const presents = await io.in(salleTable(idTable)).fetchSockets();
    for (const s of presents.filter((s) => s.data.profil.role !== "mj" && normaliserPseudo(s.data.profil.pseudo) === cible)) {
      s.emit(EVENEMENTS.JOUEUR_EXPULSE, { message: "Le Maitre du Jeu t'a expulse de la table." });
      s.disconnect(true);
    }
    console.log(`[temps-reel] ${pseudo} a ete expulse de la table ${idTable}.`);
    return {};
  });

  // Mot de passe oublie : le compte est oublie, le joueur en choisira un
  // nouveau a sa prochaine connexion (dis-lui de se reconnecter vite).
  ctx.guichet(socket, EVENEMENTS.JOUEUR_REINITIALISER_MOT_DE_PASSE, Cibler, ({ pseudo }) => {
    ctx.exigerMJ(socket, "reinitialiser un mot de passe");
    if (!ctx.sessions.reinitialiserMotDePasse(pseudo)) throw new ErreurRegle(`${pseudo} n'a pas encore de mot de passe.`);
    console.log(`[acces] Mot de passe de ${pseudo} reinitialise par le MJ.`);
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.JOUEUR_READMETTRE, Cibler, ({ pseudo }) => {
    ctx.exigerMJ(socket, "readmettre un joueur");
    ctx.expulses(ctx.exigerTable(socket)).delete(normaliserPseudo(pseudo));
    return {};
  });
}
