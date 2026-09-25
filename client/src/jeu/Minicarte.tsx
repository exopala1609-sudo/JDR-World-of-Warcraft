import { useEffect, useRef } from "react";
import { carte } from "@/core/carte";
import { useJeu } from "@/core/jeu";
import { OutilsCarte } from "@/jeu/OutilsCarte";

const TAILLE = 250;
const INTERVALLE_MS = 250; // au plus 4 rafraichissements par seconde

/**
 * Minicarte ronde : vue d'ensemble de toute la carte (brouillard compris).
 * Juste dessous, comme les boutons autour de la minicarte de WoW : les outils
 * de la carte (deplacer, tracer, pinguer).
 */
export function Minicarte() {
  const refCanvas = useRef<HTMLCanvasElement>(null);
  const table = useJeu((e) => e.table);

  useEffect(() => {
    let minuterie: number | null = null;
    const dessiner = () => {
      minuterie = null;
      if (carte.moteur && refCanvas.current) carte.moteur.dessinerApercu(refCanvas.current);
    };
    dessiner();
    return carte.surChangement(() => {
      if (minuterie === null) minuterie = window.setTimeout(dessiner, INTERVALLE_MS);
    });
  }, []);

  return (
    <div className="minicarte">
      <div className="minicarte__zone cadre titre-or">{table?.nom ?? ""}</div>
      <div className="minicarte__rond">
        <canvas ref={refCanvas} width={TAILLE} height={TAILLE} />
      </div>
      <OutilsCarte />
    </div>
  );
}
