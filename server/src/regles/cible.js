// La cible d'une action (sort, attaque) : le pion ou le cadre clique avant de
// lancer. Facultative : sans cible, le resultat va seulement dans la discussion.
//
// REGLE D'OR : rien ici ne touche aux points de vie. Le jeu CALCULE et AFFICHE
// (texte flottant, "touche / rate") ; c'est le MJ qui retire les PV, a la main.
import { COULEUR_SOINS, couleurDegats } from "../../../shared/types-degats.js";
import { schemaId } from "../modeles/identifiants.js";

export const idCible = schemaId("p").optional();

/**
 * La cible d'une action (le pion ou le cadre clique), si elle est valable : a la
 * meme table, et, pour un joueur, un monstre qu'il VOIT (il n'a de toute facon
 * pas l'identifiant des autres). Une cible invalide est simplement ignoree.
 */
export function cibleDuJet(ctx, socket, personnage, id) {
  if (!id) return null;
  const cible = ctx.depot.obtenirPersonnage(id);
  if (!cible || cible.idTable !== personnage.idTable) return null;
  if (!ctx.estMJ(socket) && !ctx.pnjVisible(cible)) return null;
  return { idPersonnage: cible.id, nom: cible.nom };
}

/**
 * Ce que le jet fait a sa cible, pour l'affichage SEULEMENT (les PV ne bougent
 * pas : c'est le MJ qui les retire, a la main). Une attaque touche si son total
 * atteint la CA de la cible (20 naturel : toujours ; 1 naturel : jamais). Un
 * sort a sauvegarde, ou des soins : le montant, sans verdict.
 * Renvoie { touche, texte } : texte = le texte flottant au-dessus du pion.
 */
export function effetSurLaCible(jet, cible) {
  const premiere = jet.lignes[0];
  const estAttaque = premiere && premiere.d20 !== null && ["arme", "sort"].includes(jet.action?.genre);
  const critique = Boolean(estAttaque && premiere.critique);
  let touche = null;
  if (estAttaque) touche = premiere.echec ? false : critique ? true : cible ? premiere.total >= cible.classeArmure : null;
  if (touche === false) return { touche, texte: { genre: "rate", montant: 0, critique: false } };
  const ligne = jet.lignes.find((l) => l.libelle.startsWith("Degats") || l.libelle === "Soins");
  if (!ligne) return { touche, texte: null };
  if (ligne.libelle === "Soins") return { touche, texte: { genre: "soins", montant: ligne.total, critique: false, couleur: COULEUR_SOINS } };
  const type = ligne.libelle.match(/\((.+)\)/)?.[1] ?? null;
  return { touche, texte: { genre: "degats", montant: ligne.total, critique, type, couleur: couleurDegats(type) } };
}

