import { useEffect, useState } from "react";

export const LARGEUR_REF = 2560;
export const HAUTEUR_REF = 1440;

/**
 * Toute l'interface est dessinee dans un cadre fixe de 2560x1440.
 * Ce hook calcule le facteur de zoom pour que ce cadre remplisse la fenetre
 * sans jamais se deformer : les positions restent identiques pour tout le monde.
 */
export function useEchelle1440p() {
  const [etat, setEtat] = useState(() => calculer());

  useEffect(() => {
    const auRedimensionnement = () => setEtat(calculer());
    window.addEventListener("resize", auRedimensionnement);
    return () => window.removeEventListener("resize", auRedimensionnement);
  }, []);

  return etat;
}

function calculer() {
  const largeur = window.innerWidth;
  const hauteur = window.innerHeight;
  const echelle = Math.min(largeur / LARGEUR_REF, hauteur / HAUTEUR_REF);

  return {
    echelle,
    decalageX: Math.round((largeur - LARGEUR_REF * echelle) / 2),
    decalageY: Math.round((hauteur - HAUTEUR_REF * echelle) / 2),
    // Interface verrouillee en paysage : ni mobile, ni tablette verticale.
    orientationInvalide: hauteur > largeur,
  };
}
