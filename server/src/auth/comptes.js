// Les comptes des joueurs : un pseudo = un mot de passe.
//
// Premiere connexion avec un pseudo : le mot de passe tape est enregistre.
// Ensuite, ce pseudo n'entre qu'avec ce mot de passe. Personne ne peut donc
// plus "emprunter" le pseudo d'un autre pour jouer son personnage ou lire ses
// notes. Mot de passe oublie : le MJ le reinitialise (menu du personnage).
//
// Le mot de passe n'est JAMAIS enregistre tel quel. On garde son "empreinte"
// (scrypt) : comme une empreinte digitale, elle permet de reconnaitre le bon
// mot de passe, mais pas de le retrouver. Meme quelqu'un qui lirait le
// fichier comptes.json ne connaitrait aucun mot de passe.
//
// Fichier : parties/comptes.json (copie avec les sauvegardes).
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { ecrireJsonAtomique, lireTexteJson } from "../fichiers.js";
import { ErreurRegle } from "../regles/erreurs.js";

const scryptAsync = promisify(scrypt);

// Reglages de scrypt : ~16 Mo de memoire et une fraction de seconde par essai,
// meme sur le NAS. Assez lent pour decourager qui voudrait tester des milliers
// de mots de passe, assez rapide pour qu'un joueur ne remarque rien.
const PARAMETRES = { N: 16384, r: 8, p: 1 };
const LONGUEUR_EMPREINTE = 32;

export const MOT_DE_PASSE_MIN = 6;
export const MOT_DE_PASSE_MAX = 100;
// Un groupe de 6 joueurs n'a pas besoin de plus : au-dela, quelqu'un s'amuse.
export const COMPTES_MAX = 50;

/** "Thrall " et "thrall" designent le meme compte. */
const cle = (pseudo) => String(pseudo ?? "").trim().toLocaleLowerCase("fr");

async function empreinteDe(motDePasse, sel, { N, r, p } = PARAMETRES) {
  return scryptAsync(String(motDePasse), sel, LONGUEUR_EMPREINTE, { N, r, p, maxmem: 64 * 1024 * 1024 });
}

/** "scrypt$16384$8$1$<sel>$<empreinte>" (les reglages sont gardes : on pourra les durcir plus tard). */
export async function fabriquerEmpreinte(motDePasse) {
  const sel = randomBytes(16);
  const hache = await empreinteDe(motDePasse, sel);
  return ["scrypt", PARAMETRES.N, PARAMETRES.r, PARAMETRES.p, sel.toString("base64"), hache.toString("base64")].join("$");
}

export async function verifierEmpreinte(motDePasse, empreinte) {
  const [algo, N, r, p, sel, attendu] = String(empreinte).split("$");
  if (algo !== "scrypt" || !sel || !attendu) return false;
  const attenduOctets = Buffer.from(attendu, "base64");
  const calcule = await empreinteDe(motDePasse, Buffer.from(sel, "base64"), { N: Number(N), r: Number(r), p: Number(p) });
  return calcule.length === attenduOctets.length && timingSafeEqual(calcule, attenduOctets);
}

/**
 * Le registre des comptes, lu au demarrage et reecrit a chaque changement.
 * "chemin" absent (tests) : les comptes restent en memoire.
 */
export function creerRegistreComptes(chemin = null) {
  /** @type {Record<string, {pseudo: string, empreinte: string, creeLe: string}>} */
  let comptes = {};

  if (chemin && existsSync(chemin)) {
    // Fichier abime : on prefere refuser de demarrer plutot que de repartir
    // d'un registre vide (n'importe qui pourrait alors reprendre un pseudo).
    const lu = lireTexteJson(chemin);
    comptes = lu?.comptes && typeof lu.comptes === "object" ? lu.comptes : {};
  }

  const enregistrer = () => {
    if (chemin) ecrireJsonAtomique(chemin, { comptes });
  };

  return {
    existe: (pseudo) => Boolean(comptes[cle(pseudo)]),
    nombre: () => Object.keys(comptes).length,

    /**
     * Verifie le mot de passe d'un pseudo, ou cree le compte s'il est nouveau.
     * Renvoie "cree" ou "ok" ; "refuse" si le mot de passe ne correspond pas.
     */
    async verifierOuCreer(pseudo, motDePasse) {
      const compte = comptes[cle(pseudo)];
      if (compte) return (await verifierEmpreinte(motDePasse ?? "", compte.empreinte)) ? "ok" : "refuse";

      const propre = String(motDePasse ?? "");
      if (propre.length < MOT_DE_PASSE_MIN) {
        throw new ErreurRegle(`Premiere connexion : choisis un mot de passe d'au moins ${MOT_DE_PASSE_MIN} caracteres.`);
      }
      if (propre.length > MOT_DE_PASSE_MAX) throw new ErreurRegle("Mot de passe trop long.");
      if (Object.keys(comptes).length >= COMPTES_MAX) throw new ErreurRegle("Trop de comptes sur ce serveur : demande au MJ.");
      // Deux connexions simultanees avec un pseudo neuf : la premiere gagne.
      const empreinte = await fabriquerEmpreinte(propre);
      if (comptes[cle(pseudo)]) return (await verifierEmpreinte(propre, comptes[cle(pseudo)].empreinte)) ? "ok" : "refuse";
      comptes[cle(pseudo)] = { pseudo: String(pseudo).trim(), empreinte, creeLe: new Date().toISOString() };
      enregistrer();
      return "cree";
    },

    /** Oublie le mot de passe d'un pseudo : la prochaine connexion en choisira un nouveau. */
    reinitialiser(pseudo) {
      if (!comptes[cle(pseudo)]) return false;
      delete comptes[cle(pseudo)];
      enregistrer();
      return true;
    },
  };
}
