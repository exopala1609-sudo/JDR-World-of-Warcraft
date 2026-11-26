// Les adresses HTTP liees a l'acces. Une seule pour ce sprint :
//   POST /api/connexion   { role, pseudo, motDePasse, codeTable? }  ->  { jeton, profil, compteCree }
// Tout le reste du jeu passe ensuite par le canal temps reel.
import express from "express";
import { ROLES } from "../../../shared/protocole.js";
import { poserCookieJeton } from "./cookie.js";
import { DUREE_JETON_MS, ErreurAcces } from "./sessions.js";

export function routesAcces(sessions) {
  const routeur = express.Router();

  routeur.post("/api/connexion", express.json({ limit: "4kb" }), async (requete, reponse) => {
    try {
      const resultat = await sessions.connecter(requete.body ?? {}, requete.ip);
      console.log(`[acces] ${resultat.profil.pseudo} connecte (${resultat.profil.role})${resultat.compteCree ? " : nouveau compte" : ""}.`);
      // Le meme jeton, en cookie : pour les images, sons et cartes (voir cookie.js).
      poserCookieJeton(requete, reponse, resultat.jeton, DUREE_JETON_MS);
      reponse.json(resultat);
    } catch (erreur) {
      if (erreur instanceof ErreurAcces) {
        reponse.status(erreur.statut).json({ erreur: erreur.message });
      } else {
        console.error("[acces]", erreur);
        reponse.status(500).json({ erreur: "Erreur interne du serveur." });
      }
    }
  });

  // Un onglet qui reprend sa session (F5) redemande son cookie : utile si le
  // navigateur l'a perdu, ou si plusieurs onglets jouent des roles differents.
  routeur.post("/api/cookie", (requete, reponse) => {
    const jeton = requete.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!sessions.verifier(jeton)) return reponse.status(401).json({ erreur: "Session expiree." });
    poserCookieJeton(requete, reponse, jeton, DUREE_JETON_MS);
    reponse.json({ ok: true });
  });

  return routeur;
}

/** Garde-barriere pour les adresses reservees au MJ (en-tete Authorization). */
export function exigerMJ(sessions) {
  return (requete, reponse, suite) => {
    const jeton = requete.get("authorization")?.replace(/^Bearer\s+/i, "");
    const profil = sessions.verifier(jeton);
    if (profil?.role !== ROLES.MJ) {
      reponse.status(401).json({ erreur: "Reserve au Maitre du Jeu." });
      return;
    }
    suite();
  };
}
