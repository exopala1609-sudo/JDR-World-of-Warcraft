// Dessin tactique : les traces que joueurs et MJ tracent sur la carte pour
// planifier une attaque ou montrer un chemin. Fonctions PURES (testees).
//
// Une trace appartient a son auteur. Son identifiant est fabrique PAR LE
// SERVEUR a partir du pseudo de l'auteur : "thrall:k3f9a2". Un joueur ne peut
// donc jamais prolonger ni effacer la trace d'un autre, meme en trafiquant
// ses messages.
import { normaliserPseudo } from "../auth/sessions.js";
import { borner } from "../../../shared/geometrie.js";
import { ErreurRegle } from "./erreurs.js";

export const LIMITES_DESSIN = {
  pointsParMorceau: 64, // un morceau part toutes les 50 ms pendant le trace
  pointsParTrace: 2000,
  tracesParTable: 150,
};

const arrondir = (n) => Math.round(n * 10) / 10;

/**
 * Ajoute un morceau a une trace (et la cree si besoin).
 * Renvoie { traces, trace, morceau } : morceau = les points acceptes, tels
 * qu'ils doivent etre diffuses aux autres (bornes a la carte, arrondis).
 */
export function prolongerTrace(traces, { auteur, cle, couleur, points }, carte) {
  const id = `${normaliserPseudo(auteur)}:${cle}`;
  const morceau = points.map(([x, y]) => {
    const p = borner(x, y, carte);
    return [arrondir(p.x), arrondir(p.y)];
  });
  const existante = traces.find((t) => t.id === id);

  if (!existante) {
    if (traces.length >= LIMITES_DESSIN.tracesParTable) {
      throw new ErreurRegle("Trop de traces sur la carte : effacez-en quelques-unes.");
    }
    const trace = { id, auteur, couleur, points: morceau };
    return { traces: [...traces, trace], trace, morceau };
  }
  if (existante.points.length + morceau.length > LIMITES_DESSIN.pointsParTrace) {
    throw new ErreurRegle("Trace trop longue : relachez la souris et recommencez.");
  }
  const trace = { ...existante, points: [...existante.points, ...morceau] };
  return { traces: traces.map((t) => (t.id === id ? trace : t)), trace, morceau };
}

/** Efface les traces d'un auteur, ou toutes (auteur = null, reserve au MJ). */
export function effacerTraces(traces, auteur) {
  if (auteur === null) return [];
  const moi = normaliserPseudo(auteur);
  return traces.filter((t) => normaliserPseudo(t.auteur) !== moi);
}
