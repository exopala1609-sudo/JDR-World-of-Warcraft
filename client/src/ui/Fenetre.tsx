import { useRef, useState, type ReactNode, type PointerEvent } from "react";

/**
 * Fenetre facon WoW : barre de titre (qu'on peut tirer pour la deplacer) et
 * bouton de fermeture. Les coordonnees sont celles de la surface de jeu
 * (1 px = 1 px de l'ecran 1440p), quel que soit le zoom de l'interface.
 */
export function Fenetre({
  titre,
  classe,
  positionInitiale,
  surFermer,
  children,
}: {
  titre: string;
  classe: string;
  positionInitiale: { x: number; y: number };
  surFermer: () => void;
  children: ReactNode;
}) {
  const [position, setPosition] = useState(positionInitiale);
  const tirage = useRef<{ x: number; y: number; depart: { x: number; y: number }; echelle: number } | null>(null);

  const appui = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const scene = document.querySelector(".scene-jeu")!.getBoundingClientRect();
    const echelle = scene.width / (document.querySelector(".scene-jeu") as HTMLElement).offsetWidth;
    tirage.current = { x: e.clientX, y: e.clientY, depart: position, echelle };
  };
  const mouvement = (e: PointerEvent<HTMLDivElement>) => {
    const t = tirage.current;
    if (!t) return;
    setPosition({ x: t.depart.x + (e.clientX - t.x) / t.echelle, y: t.depart.y + (e.clientY - t.y) / t.echelle });
  };

  return (
    <section className={`fenetre cadre ${classe}`} style={{ left: position.x, top: position.y }}>
      <div
        className="fenetre__entete"
        onPointerDown={appui}
        onPointerMove={mouvement}
        onPointerUp={() => (tirage.current = null)}
      >
        <h2 className="titre-or fenetre__titre">{titre}</h2>
        <button className="bouton-fermer" type="button" onClick={surFermer} aria-label="Fermer">
          x
        </button>
      </div>
      <div className="fenetre__corps">{children}</div>
    </section>
  );
}
