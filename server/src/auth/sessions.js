// Portail d'acces : qui a le droit d'entrer, et avec quel role.
//
// Principe du "jeton" (comme un bracelet de festival) :
//  1. On se presente une fois a l'entree (pseudo, + mot de passe pour le MJ).
//  2. Le serveur remet un jeton : une longue suite de caracteres aleatoires.
//  3. Ensuite, le navigateur montre ce jeton a chaque connexion temps reel.
//     Le mot de passe du MJ ne circule donc qu'une seule fois.
//
// Les jetons vivent en memoire : si le serveur redemarre, chacun se reconnecte.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ROLES } from "../../../shared/protocole.js";
import { ErreurRegle } from "../regles/erreurs.js";

export const DUREE_JETON_MS = 12 * 60 * 60 * 1000; // une longue soiree de jeu
const ESSAIS_MAX = 5;
const FENETRE_ESSAIS_MS = 15 * 60 * 1000;
const MOTS_DE_PASSE_INTERDITS = new Set(["", "change-moi"]);

// Lettres (accents compris), chiffres, espace, tiret, apostrophe, souligne.
const MOTIF_PSEUDO = /^[\p{L}\p{N} _'-]{2,24}$/u;

export class ErreurAcces extends ErreurRegle {
  constructor(message, statut) {
    super(message);
    this.statut = statut;
  }
}

/** "Thrall " et "thrall" designent le meme joueur. */
export const normaliserPseudo = (pseudo) => String(pseudo ?? "").trim().toLocaleLowerCase("fr");

// Comparaison a duree constante : le temps de reponse ne revele pas
// combien de caracteres du mot de passe etaient justes.
function motsDePasseIdentiques(propose, attendu) {
  const empreinte = (texte) => createHash("sha256").update(String(texte)).digest();
  return timingSafeEqual(empreinte(propose), empreinte(attendu));
}

// Pseudos qu'un joueur ne peut pas prendre : on ne doit pas pouvoir se faire
// passer pour le MJ dans la discussion ou la liste des presents.
const PSEUDOS_RESERVES = new Set(["mj", "gm", "maitre du jeu", "maître du jeu", "maitre-du-jeu", "admin", "administrateur"]);

/**
 * "comptes" : le registre des mots de passe des joueurs (auth/comptes.js).
 * Sans registre (certains tests), un pseudo suffit, comme avant le lot 2.
 */
export function creerGestionnaireSessions({ motDePasseMJ, codeTable = "", comptes = null }) {
  /** @type {Map<string, {role: string, pseudo: string, expireLe: number}>} */
  const jetons = new Map();
  /** @type {Map<string, {nombre: number, depuis: number}>} */
  const echecsParAdresse = new Map();

  const motDePasseUtilisable = !MOTS_DE_PASSE_INTERDITS.has(motDePasseMJ) && motDePasseMJ.length >= 6;

  const codeTableRequis = codeTable.length > 0;

  // Anti "force brute" : 5 mauvais mots de passe (MJ ou code de table) depuis
  // la meme adresse -> 15 minutes d'attente.
  function verifierEssais(adresse) {
    const essais = echecsParAdresse.get(adresse);
    if (!essais) return;
    if (Date.now() - essais.depuis > FENETRE_ESSAIS_MS) {
      echecsParAdresse.delete(adresse);
    } else if (essais.nombre >= ESSAIS_MAX) {
      throw new ErreurAcces("Trop d'essais. Reessaie dans quelques minutes.", 429);
    }
  }

  function noterEchec(adresse) {
    const essais = echecsParAdresse.get(adresse) ?? { nombre: 0, depuis: Date.now() };
    essais.nombre += 1;
    echecsParAdresse.set(adresse, essais);
  }

  function emettreJeton(profil) {
    const jeton = randomBytes(32).toString("base64url");
    jetons.set(jeton, { ...profil, expireLe: Date.now() + DUREE_JETON_MS });
    return jeton;
  }

  return {
    motDePasseUtilisable,
    codeTableRequis,

    /**
     * Echange des identifiants contre un jeton. Leve une ErreurAcces sinon.
     * Pour un joueur : "motDePasse" est SON mot de passe, "codeTable" le code
     * commun eventuel (VTT_CODE_TABLE). "compteCree" : c'etait sa premiere fois.
     */
    async connecter({ role, pseudo, motDePasse, codeTable: codePropose }, adresse) {
      if (role === ROLES.MJ) {
        if (!motDePasseUtilisable) {
          throw new ErreurAcces(
            "Acces MJ desactive : choisis un vrai mot de passe (6 caracteres minimum) " +
              "dans le fichier .env (VTT_MOTDEPASSE_MJ), puis relance le serveur.",
            403,
          );
        }
        verifierEssais(adresse);
        if (!motsDePasseIdentiques(motDePasse ?? "", motDePasseMJ)) {
          noterEchec(adresse);
          throw new ErreurAcces("Mot de passe MJ incorrect.", 401);
        }
        echecsParAdresse.delete(adresse);
        const profil = { role: ROLES.MJ, pseudo: "Maitre du Jeu" };
        return { jeton: emettreJeton(profil), profil };
      }

      if (role === ROLES.JOUEUR) {
        const propre = String(pseudo ?? "").trim();
        if (!MOTIF_PSEUDO.test(propre)) {
          throw new ErreurAcces("Pseudo invalide : 2 a 24 lettres, chiffres, espaces ou tirets.", 400);
        }
        if (PSEUDOS_RESERVES.has(normaliserPseudo(propre))) {
          throw new ErreurAcces("Ce pseudo est reserve au Maitre du Jeu. Choisis-en un autre.", 400);
        }
        verifierEssais(adresse);
        if (codeTableRequis && !motsDePasseIdentiques(codePropose ?? "", codeTable)) {
          noterEchec(adresse);
          throw new ErreurAcces("Code de la table incorrect.", 401);
        }
        let compteCree = false;
        if (comptes) {
          let resultat;
          try {
            resultat = await comptes.verifierOuCreer(propre, motDePasse);
          } catch (erreur) {
            if (erreur instanceof ErreurRegle) throw new ErreurAcces(erreur.message, 400);
            throw erreur;
          }
          if (resultat === "refuse") {
            noterEchec(adresse);
            throw new ErreurAcces(`Mot de passe incorrect pour ${propre}. Oublie ? Demande au MJ de le reinitialiser.`, 401);
          }
          compteCree = resultat === "cree";
        }
        echecsParAdresse.delete(adresse);
        const profil = { role: ROLES.JOUEUR, pseudo: propre };
        return { jeton: emettreJeton(profil), profil, compteCree };
      }

      throw new ErreurAcces("Role inconnu.", 400);
    },

    /**
     * MJ : oublie le mot de passe d'un joueur. Ses connexions en cours restent
     * ouvertes ; a sa prochaine connexion, il choisira un nouveau mot de passe.
     */
    reinitialiserMotDePasse(pseudo) {
      return comptes ? comptes.reinitialiser(pseudo) : false;
    },

    /** Annule tous les jetons d'un joueur (expulsion) : il doit se reconnecter. */
    revoquerPseudo(pseudo) {
      const cible = normaliserPseudo(pseudo);
      for (const [jeton, session] of jetons) {
        if (session.role === ROLES.JOUEUR && normaliserPseudo(session.pseudo) === cible) jetons.delete(jeton);
      }
    },

    /** Renvoie le profil associe a un jeton valide, sinon null. */
    verifier(jeton) {
      if (typeof jeton !== "string") return null;
      const session = jetons.get(jeton);
      if (!session) return null;
      if (session.expireLe < Date.now()) {
        jetons.delete(jeton);
        return null;
      }
      return { role: session.role, pseudo: session.pseudo };
    },
  };
}
