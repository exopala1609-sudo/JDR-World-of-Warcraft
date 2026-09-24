import { useSyncExternalStore, type ReactNode } from "react";

// Une seule infobulle pour toute l'interface, comme dans WoW. N'importe quel
// composant peut l'afficher (montrer) ou la cacher, sans se soucier de l'endroit
// ou elle est dessinee.
type EtatInfobulle = { contenu: ReactNode; x: number; y: number; versGauche: boolean; versHaut: boolean } | null;
let etat: EtatInfobulle = null;
const abonnes = new Set<() => void>();
const publier = (nouvel: EtatInfobulle) => {
  etat = nouvel;
  abonnes.forEach((rappel) => rappel());
};

/** Coordonnees de la souris dans la surface de jeu (tient compte du zoom). */
function versScene(clientX: number, clientY: number) {
  const scene = document.querySelector(".scene-jeu") as HTMLElement;
  const rect = scene.getBoundingClientRect();
  const echelle = rect.width / scene.offsetWidth;
  return {
    x: (clientX - rect.left) / echelle,
    y: (clientY - rect.top) / echelle,
    largeur: scene.offsetWidth,
    hauteur: scene.offsetHeight,
  };
}

/** A brancher sur un element : props onPointerEnter / Move / Leave. */
export function avecInfobulle(contenu: () => ReactNode) {
  const placer = (e: React.PointerEvent) => {
    const { x, y, largeur, hauteur } = versScene(e.clientX, e.clientY);
    // Pres d'un bord, l'infobulle s'ouvre de l'autre cote du curseur.
    publier({ contenu: contenu(), x, y, versGauche: x > largeur - 400, versHaut: y > hauteur * 0.55 });
  };
  return { onPointerEnter: placer, onPointerMove: placer, onPointerLeave: () => publier(null) };
}

export function CoucheInfobulle() {
  const actuel = useSyncExternalStore(
    (rappel) => {
      abonnes.add(rappel);
      return () => {
        abonnes.delete(rappel);
      };
    },
    () => etat,
  );
  if (!actuel) return null;
  return (
    <div
      className="infobulle"
      style={{
        left: actuel.x + (actuel.versGauche ? -18 : 18),
        top: actuel.y + (actuel.versHaut ? -18 : 18),
        transform: `translate(${actuel.versGauche ? "-100%" : "0"}, ${actuel.versHaut ? "-100%" : "0"})`,
      }}
    >
      {actuel.contenu}
    </div>
  );
}
