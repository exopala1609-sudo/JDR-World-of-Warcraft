import { useEffect, useRef } from "react";
import { MoteurCarte } from "@partage/moteur-carte.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { carte } from "@/core/carte";
import { jeu, useJeu } from "@/core/jeu";
import { useEchelleInterface } from "@/core/useEchelleInterface";

/**
 * Le "monde" : notre moteur Canvas du sprint 3, en plein ecran, sous toute
 * l'interface. Le composant ne dessine rien lui-meme : il cree le moteur une
 * fois, puis lui transmet la scene et les messages du serveur.
 */
export function CarteMonde() {
  const refCanvas = useRef<HTMLCanvasElement>(null);
  const scene = useJeu((e) => e.scene);
  const { largeur, hauteur } = useEchelleInterface();

  // 1. Creation du moteur (une seule fois) et branchement sur le serveur.
  useEffect(() => {
    const moteur = new MoteurCarte(refCanvas.current!, {
      get estMJ() {
        return jeu.estMJ();
      },
      // Confort d'affichage : le serveur verifie de toute facon.
      peutDeplacer: (pion: { proprietaire: string | null }) =>
        jeu.estMJ() || pion.proprietaire?.toLocaleLowerCase("fr") === jeu.lire().profil?.pseudo.toLocaleLowerCase("fr"),
      surSaisie: async (pion: { id: string }) => (await jeu.demander(EVENEMENTS.PION_SAISIR, { idPion: pion.id })).ok,
      surDeplacement: async (pion: { id: string }, x: number, y: number, final: boolean, aimanter: boolean) => {
        if (!final) {
          jeu.socket?.emit(EVENEMENTS.PION_DEPLACER, { idPion: pion.id, x, y, final: false, aimanter });
          return null;
        }
        const r = await jeu.demander(EVENEMENTS.PION_DEPLACER, { idPion: pion.id, x, y, final: true, aimanter });
        return r.ok ? r.position : null;
      },
      surTrait: () => {},
      surInfo: () => {},
      surChangement: () => carte.signalerChangement(),
    });
    carte.moteur = moteur;

    // Messages frequents : directement au moteur, sans redessiner l'interface.
    const desabonner = jeu.ecouterCarte((evenement, donnees) => {
      if (evenement === EVENEMENTS.PION_POSITION) moteur.positionPion(donnees.idPion, donnees.x, donnees.y);
      else if (evenement === EVENEMENTS.BROUILLARD_TRAIT_AJOUTE) moteur.ajouterTrait(donnees.trait);
      else if (evenement === EVENEMENTS.SCENE_GRILLE_MAJ) moteur.majGrille(donnees.grille);
    });
    return () => {
      desabonner();
      carte.moteur = null;
    };
  }, []);

  // 2. La surface du Canvas suit la taille de l'ecran de jeu.
  useEffect(() => {
    carte.moteur?.redimensionner(largeur, hauteur);
  }, [largeur, hauteur]);

  // 3. Chaque nouvelle photo de la scene est transmise au moteur.
  useEffect(() => {
    if (scene) carte.moteur?.chargerScene(scene);
  }, [scene]);

  return (
    <div className="monde">
      <canvas ref={refCanvas} />
    </div>
  );
}
