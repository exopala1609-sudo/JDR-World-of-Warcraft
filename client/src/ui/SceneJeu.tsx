import type { ReactNode } from "react";
import { useEchelleInterface } from "@/core/useEchelleInterface";

/**
 * Surface de jeu plein ecran. Les enfants se positionnent en s'accrochant
 * aux bords (top/left/right/bottom), comme les cadres de l'interface de WoW.
 */
export function SceneJeu({ children }: { children: ReactNode }) {
  const { echelle, largeur, hauteur, orientationInvalide } = useEchelleInterface();

  if (orientationInvalide) {
    return (
      <div className="orientation-invalide">
        <strong>Ecran en mode portrait detecte.</strong>
        <span>Ce VTT se joue sur un ecran paysage.</span>
      </div>
    );
  }

  return (
    <div
      className="scene-jeu"
      style={{
        width: largeur,
        height: hauteur,
        // A 100 % on n'applique aucune transformation : le texte reste net.
        transform: echelle < 1 ? `scale(${echelle})` : undefined,
      }}
    >
      {children}
    </div>
  );
}
