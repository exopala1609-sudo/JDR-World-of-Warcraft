// Geometrie de la carte : fichier PARTAGE.
// Le navigateur s'en sert pour PREVISUALISER (ou le pion va tomber, combien
// de cases il parcourt) ; le serveur s'en sert pour ARBITRER. Les deux font
// donc exactement le meme calcul : pas de surprise au lacher du pion.
//
// Toutes les coordonnees sont en pixels DE L'IMAGE de la carte (et non de
// l'ecran) : un pion en (1200, 800) est au meme endroit sur tous les ecrans,
// quels que soient le zoom et le decalage de la vue de chacun.

export const METRES_PAR_CASE = 1.5; // 5 pieds

/** Case (colonne, ligne) qui contient un point. */
export function caseDe(x, y, grille) {
  return {
    colonne: Math.floor((x - grille.decalageX) / grille.taille),
    ligne: Math.floor((y - grille.decalageY) / grille.taille),
  };
}

/**
 * Aimante un point a la grille : au centre d'une case pour un pion de taille
 * impaire (1 case), sur une intersection pour un pion de taille paire (2x2).
 */
export function aimanter(x, y, grille, taillePion = 1) {
  const { taille, decalageX, decalageY } = grille;
  const demi = taillePion % 2 === 1 ? 0.5 : 0;
  return {
    x: decalageX + (Math.round((x - decalageX) / taille - demi) + demi) * taille,
    y: decalageY + (Math.round((y - decalageY) / taille - demi) + demi) * taille,
  };
}

/** Garde un point a l'interieur de la carte. */
export function borner(x, y, carte) {
  return {
    x: Math.min(carte.largeur, Math.max(0, x)),
    y: Math.min(carte.hauteur, Math.max(0, y)),
  };
}

/**
 * Distance en cases entre deux points, regle par defaut de D&D 5e :
 * une diagonale compte comme une case (on prend le plus grand ecart).
 */
export function distanceEnCases(a, b, grille) {
  const ca = caseDe(a.x, a.y, grille);
  const cb = caseDe(b.x, b.y, grille);
  return Math.max(Math.abs(ca.colonne - cb.colonne), Math.abs(ca.ligne - cb.ligne));
}

// --- Brouillard de guerre -----------------------------------------------------
// Le brouillard est une liste ordonnee de "traits" de pinceau :
//   { mode: "reveler" | "cacher", rayon, points: [[x, y], ...] }
// Au depart, tout est noir. On rejoue les traits dans l'ordre : la gomme
// ("reveler") creuse le noir, le pinceau ("cacher") le remet.

function distanceAuSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const longueur2 = dx * dx + dy * dy;
  const t = longueur2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / longueur2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Le trait passe-t-il sur ce point ? */
export function traitCouvre(trait, x, y) {
  const { points, rayon } = trait;
  if (points.length === 1) return Math.hypot(x - points[0][0], y - points[0][1]) <= rayon;
  for (let i = 1; i < points.length; i++) {
    if (distanceAuSegment(x, y, points[i - 1], points[i]) <= rayon) return true;
  }
  return false;
}

/**
 * Ce point est-il visible par les joueurs ? On remonte les traits du plus
 * recent au plus ancien : le premier qui couvre le point decide.
 */
export function estRevele(brouillard, x, y) {
  if (!brouillard.actif) return true;
  for (let i = brouillard.traits.length - 1; i >= 0; i--) {
    const trait = brouillard.traits[i];
    if (trait.mode === "tout-reveler") return true;
    if (traitCouvre(trait, x, y)) return trait.mode === "reveler";
  }
  return false;
}
