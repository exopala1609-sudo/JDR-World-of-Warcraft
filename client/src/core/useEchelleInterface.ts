import { useEffect, useState } from "react";

/**
 * Surface minimale garantie pour l'interface, en pixels "logiques".
 * Toute la mise en page est pensee pour tenir dans 1920x1080 au minimum,
 * puis profite de l'espace en plus (jusqu'au 2560x1440 du groupe et au-dela).
 */
export const LARGEUR_MIN = 1920;
export const HAUTEUR_MIN = 1080;

/**
 * Meme principe que l'interface de World of Warcraft :
 *  - la scene remplit toujours toute la fenetre, sans bande noire ;
 *  - les elements s'accrochent aux bords (portraits en haut a gauche,
 *    minicarte en haut a droite, barres d'action en bas au centre) ;
 *  - l'espace en plus ou en moins se reporte sur la carte, au centre ;
 *  - l'interface reste a 100 % (texte net) tant que la fenetre offre au moins
 *    1920x1080, et ne rapetisse, proportionnellement, qu'en dessous.
 */
export function useEchelleInterface() {
  const [etat, setEtat] = useState(() => calculer());

  useEffect(() => {
    const auRedimensionnement = () => setEtat(calculer());
    window.addEventListener("resize", auRedimensionnement);
    return () => window.removeEventListener("resize", auRedimensionnement);
  }, []);

  return etat;
}

function calculer() {
  const largeurFenetre = window.innerWidth;
  const hauteurFenetre = window.innerHeight;
  const echelle = Math.min(1, largeurFenetre / LARGEUR_MIN, hauteurFenetre / HAUTEUR_MIN);

  return {
    echelle,
    // Dimensions de la surface de jeu, dans les pixels de l'interface.
    largeur: Math.round(largeurFenetre / echelle),
    hauteur: Math.round(hauteurFenetre / echelle),
    // Interface reservee au paysage : ni mobile, ni tablette verticale.
    orientationInvalide: hauteurFenetre > largeurFenetre,
  };
}
