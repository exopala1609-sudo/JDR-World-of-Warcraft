import { useEffect, useState } from "react";
import type { AnnonceTirage } from "@/core/types";
import { GrosDe } from "@/jeu/ModaleResolution";

const DEBUT_MS = 1100; // tous les des roulent d'abord ensemble (comme a la table)
const ECART_MS = 280; // puis chaque ligne s'arrete, l'une apres l'autre

/** L'index du de ecarte (le plus faible des 4). */
const indexEcarte = (des: number[]) => des.indexOf(Math.min(...des));

/**
 * Le tirage des caracteristiques, anime avec les memes des que la table :
 * six lignes de 4d6 qui roulent, puis s'arretent une a une ; le plus petit
 * de de chaque ligne est grise (on garde les 3 meilleurs).
 */
export function AnimationTirage({ annonce, surFin }: { annonce: AnnonceTirage; surFin: () => void }) {
  const [revelees, setRevelees] = useState(0);
  const [defile, setDefile] = useState(1);

  useEffect(() => {
    const defilement = setInterval(() => setDefile(1 + Math.floor(Math.random() * 6)), 70);
    const minuteurs = annonce.des.map((_, i) => setTimeout(() => setRevelees(i + 1), DEBUT_MS + i * ECART_MS));
    return () => {
      clearInterval(defilement);
      minuteurs.forEach(clearTimeout);
    };
  }, [annonce]);

  const fini = revelees >= annonce.des.length;
  const trie = (v: number[]) => [...v].sort((a, b) => b - a).join(", ");
  return (
    <div className="tirage-anim" role="dialog" aria-label="Tirage des caracteristiques">
      <div className="tirage-anim__cadre cadre">
        <h2 className="titre-or tirage-anim__titre">{annonce.relance ? "Relance des caracteristiques" : "Tirage des caracteristiques"}</h2>
        <p className="tirage-anim__regle">4d6 par score : on garde les 3 meilleurs des.</p>
        {annonce.des.map((des, ligne) => {
          const arretee = ligne < revelees;
          const ecarte = indexEcarte(des);
          return (
            <div key={ligne} className="tirage-anim__ligne">
              {des.map((valeur, i) => (
                <span key={i} className={`tirage-anim__de${arretee && i === ecarte ? " tirage-anim__de--ecarte" : ""}`}>
                  <GrosDe faces={6} valeur={arretee ? valeur : ((defile + i * 2 + ligne) % 6) + 1} etat={arretee ? "normal" : "roule"} />
                </span>
              ))}
              <span className="tirage-anim__score">{arretee ? annonce.valeurs[ligne] : ""}</span>
            </div>
          );
        })}
        <div className="tirage-anim__bilan">
          {fini && (
            <>
              <p>
                Total : <b>{annonce.total}</b>
              </p>
              {annonce.relance && (
                <p>
                  {annonce.garde === "nouveau" ? "C'est ton meilleur tirage : il est garde." : `Ton tirage precedent (${trie(annonce.retenu)}) reste le meilleur : il est garde.`}
                </p>
              )}
              <button type="button" className="bouton" onClick={surFin} autoFocus>
                Continuer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
