// Renommee et langues d'un personnage, modifiees en jeu par le MJ (etape 3).
// Fonctions pures : elles renvoient de nouvelles listes, sans rien ecrire.
import { ErreurRegle } from "./erreurs.js";

const SCORE_MIN = -100;
const SCORE_MAX = 1000;

/**
 * Change la renommee aupres d'une faction : "score" fixe la valeur (null = retirer
 * la faction de la fiche), sinon "variation" l'ajoute (+1, -5...). Une faction
 * absente de la fiche part de 0. Renvoie { renommees, avant, apres }.
 */
export function changerRenommee(renommees, faction, { score, variation = 0 }) {
  const actuelle = renommees.find((r) => r.faction === faction);
  const avant = actuelle?.score ?? null;
  if (score === null) {
    if (!actuelle) throw new ErreurRegle("Ce personnage n'a pas de renommee aupres de cette faction.");
    return { renommees: renommees.filter((r) => r.faction !== faction), avant, apres: null };
  }
  const brut = score !== undefined ? score : (avant ?? 0) + variation;
  const apres = Math.max(SCORE_MIN, Math.min(SCORE_MAX, brut));
  const suite = actuelle ? renommees.map((r) => (r.faction === faction ? { faction, score: apres } : r)) : [...renommees, { faction, score: apres }];
  return { renommees: suite, avant, apres };
}

/** Ajoute (connue = true) ou retire une langue. */
export function changerLangue(langues, langue, connue) {
  if (connue && langues.includes(langue)) throw new ErreurRegle("Ce personnage connait deja cette langue.");
  if (!connue && !langues.includes(langue)) throw new ErreurRegle("Ce personnage ne connait pas cette langue.");
  return connue ? [...langues, langue] : langues.filter((l) => l !== langue);
}
