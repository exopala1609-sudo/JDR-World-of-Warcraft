import type { ReactNode } from "react";
import { HAUTEUR_REF, LARGEUR_REF, useEchelle1440p } from "@/core/useEchelle1440p";

/**
 * Cadre de jeu verrouille en 2560x1440 paysage.
 * Les enfants se positionnent en pixels "1440p" sans se soucier de la fenetre.
 */
export function Scene1440p({ children }: { children: ReactNode }) {
  const { echelle, decalageX, decalageY, orientationInvalide } = useEchelle1440p();

  if (orientationInvalide) {
    return (
      <div className="orientation-invalide">
        <strong>Ecran en mode portrait detecte.</strong>
        <span>Ce VTT se joue sur un ecran paysage (prevu pour du 2560x1440).</span>
      </div>
    );
  }

  return (
    <div
      className="scene-1440p"
      style={{ transform: `translate(${decalageX}px, ${decalageY}px) scale(${echelle})` }}
      data-largeur={LARGEUR_REF}
      data-hauteur={HAUTEUR_REF}
    >
      {children}
    </div>
  );
}
