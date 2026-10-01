import { useEffect, useRef } from "react";
import { carte } from "@/core/carte";
import { jeu, useJeu } from "@/core/jeu";
import { avecInfobulle } from "@/ui/InfoBulle";
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
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const carteOuverte = useJeu((e) => e.fenetres.carteMJ);

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
        {/* MJ : le petit bouton rond sur le bord de la minicarte (comme ceux de WoW) */}
        {estMJ && (
          <button
            type="button"
            className={`minicarte__bouton-mj${carteOuverte ? " minicarte__bouton-mj--actif" : ""}`}
            onClick={() => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, carteMJ: !e.fenetres.carteMJ } }))}
            aria-label="Carte (MJ)"
            {...avecInfobulle(() => (
              <>
                <div className="infobulle__titre">Carte (MJ)</div>
                <div className="infobulle__ligne--or">Changer l'image de fond, regler la grille, le brouillard.</div>
              </>
            ))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" />
            </svg>
          </button>
        )}
      </div>
      <OutilsCarte />
    </div>
  );
}
