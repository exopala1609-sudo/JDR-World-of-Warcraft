// Portail d'acces : qui a le droit d'entrer, et avec quel role.
//
// Principe du "jeton" (comme un bracelet de festival) :
//  1. On se presente une fois a l'entree (pseudo, + mot de passe pour le MJ).
//  2. Le serveur remet un jeton : une longue suite de caracteres aleatoires.
//  3. Ensuite, le navigateur montre ce jeton a chaque connexion temps reel.
//     Le mot de passe du MJ ne circule donc qu'une seule fois.
//
// Les jetons sont aussi notes sur le disque (sessions.json) : apres un
// redemarrage du serveur (mise a jour, coupure du NAS), chacun retrouve sa
// place sans se reconnecter. Le fichier ne contient que l'EMPREINTE de chaque
// jeton : quelqu'un qui le lirait ne pourrait pas s'en servir pour entrer.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { ecrireJsonAtomique, lireTexteJson } from "../fichiers.js";
import { ROLES } from "../../../shared/protocole.js";
import { ErreurRegle } from "../regles/erreurs.js";

export const DUREE_JETON_MS = 12 * 60 * 60 * 1000; // une longue soiree de jeu
const ESSAIS_MAX = 5;
const FENETRE_ESSAIS_MS = 15 * 60 * 1000;
const NETTOYAGE_MS = 10 * 60 * 1000; // menage des jetons expires et des vieux echecs

/** L'empreinte d'un jeton : c'est elle qu'on garde, jamais le jeton lui-meme. */
const empreinteJeton = (jeton) => createHash("sha256").update(jeton).digest("base64url");
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
 * "fichierSessions" : ou noter les jetons pour survivre a un redemarrage
 * (absent : en memoire seulement).
 */
export function creerGestionnaireSessions({ motDePasseMJ, codeTable = "", comptes = null, fichierSessions = null }) {
  /** Empreinte du jeton -> session. @type {Map<string, {role: string, pseudo: string, expireLe: number}>} */
  const jetons = new Map();

  // Reprise des sessions d'avant le redemarrage (sauf celles qui ont expire).
  if (fichierSessions && existsSync(fichierSessions)) {
    try {
      const lu = lireTexteJson(fichierSessions);
      for (const [empreinte, session] of Object.entries(lu?.sessions ?? {})) {
        const valide =
          typeof session?.pseudo === "string" && Object.values(ROLES).includes(session.role) && Number.isFinite(session.expireLe);
        if (valide && session.expireLe > Date.now()) jetons.set(empreinte, { role: session.role, pseudo: session.pseudo, expireLe: session.expireLe });
      }
    } catch (erreur) {
      // Sans gravite : chacun se reconnectera simplement avec son mot de passe.
      console.warn(`[acces] Sessions precedentes illisibles (${erreur.message}) : chacun devra se reconnecter.`);
    }
  }

  function enregistrerSessions() {
    if (!fichierSessions) return;
    try {
      ecrireJsonAtomique(fichierSessions, { sessions: Object.fromEntries(jetons) });
    } catch (erreur) {
      console.warn(`[acces] Impossible de noter les sessions (${erreur.message}) : un redemarrage deconnectera tout le monde.`);
    }
  }
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
    jetons.set(empreinteJeton(jeton), { ...profil, expireLe: Date.now() + DUREE_JETON_MS });
    enregistrerSessions();
    return jeton;
  }

  /** Le menage : jetons expires et vieux compteurs d'echecs (un serveur allume des semaines ne grossit pas). */
  function nettoyer(maintenant = Date.now()) {
    let retires = 0;
    for (const [empreinte, session] of jetons) {
      if (session.expireLe < maintenant) {
        jetons.delete(empreinte);
        retires += 1;
      }
    }
    for (const [adresse, essais] of echecsParAdresse) {
      if (maintenant - essais.depuis > FENETRE_ESSAIS_MS) echecsParAdresse.delete(adresse);
    }
    if (retires) enregistrerSessions();
    return retires;
  }
  if (fichierSessions) setInterval(() => nettoyer(), NETTOYAGE_MS).unref();

  return {
    motDePasseUtilisable,
    nettoyer,
    /** Nombre de sessions ouvertes (pour le demarrage et les tests). */
    nombreSessions: () => jetons.size,
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
      for (const [empreinte, session] of jetons) {
        if (session.role === ROLES.JOUEUR && normaliserPseudo(session.pseudo) === cible) jetons.delete(empreinte);
      }
      enregistrerSessions();
    },

    /** Renvoie le profil associe a un jeton valide, sinon null. */
    verifier(jeton) {
      if (typeof jeton !== "string") return null;
      const empreinte = empreinteJeton(jeton);
      const session = jetons.get(empreinte);
      if (!session) return null;
      if (session.expireLe < Date.now()) {
        jetons.delete(empreinte);
        return null;
      }
      return { role: session.role, pseudo: session.pseudo };
    },
  };
}
