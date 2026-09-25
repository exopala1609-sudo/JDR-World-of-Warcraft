import { useEffect, useRef } from "react";
import { MoteurCarte } from "@partage/moteur-carte.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { carte } from "@/core/carte";
import { jeu, useJeu } from "@/core/jeu";
import type { TexteCombat, Trace } from "@/core/types";
import { useEchelleInterface } from "@/core/useEchelleInterface";

/**
 * Le "monde" : notre moteur Canvas du sprint 3, en plein ecran, sous toute
 * l'interface. Le composant ne dessine rien lui-meme : il cree le moteur une
 * fois, puis lui transmet la scene et les messages du serveur.
 *
 * Qui recoit le clic ? Le Canvas est TOUT AU FOND (couche "monde"). Les
 * cadres de l'interface sont au-dessus et arretent les clics qui les
 * touchent ; un clic "dans le vide" traverse jusqu'ici (voir hud.css).
 */
export function CarteMonde() {
  const refCanvas = useRef<HTMLCanvasElement>(null);
  const scene = useJeu((e) => e.scene);
  const outil = useJeu((e) => e.outil);
  const couleurTrace = useJeu((e) => e.couleurTrace);
  const { largeur, hauteur } = useEchelleInterface();

  // 1. Creation du moteur (une seule fois) et branchement sur le serveur.
  useEffect(() => {
    // Les chiffres de combat utilisent la police de l'interface (Friz Quadrata si installee).
    const police = getComputedStyle(document.documentElement).getPropertyValue("--police-ui").trim() || "sans-serif";

    const moteur = new MoteurCarte(refCanvas.current!, {
      get estMJ() {
        return jeu.estMJ();
      },
      get couleur() {
        return jeu.maCouleur();
      },
      get prefixeTraces() {
        return jeu.prefixeTraces();
      },
      police,
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
      surPing: (x: number, y: number) => jeu.demander(EVENEMENTS.CARTE_PING, { x, y }),
      surTrace: (morceau: { cle: string; couleur: string; points: [number, number][] }) =>
        jeu.demander(EVENEMENTS.DESSIN_TRAIT, morceau),
      surTrait: () => {},
      surInfo: () => {},
      surChangement: () => carte.signalerChangement(),
    });
    carte.moteur = moteur;
    moteur.chargerTraces([...jeu.traces.values()]);

    // Messages frequents : directement au moteur, sans redessiner l'interface.
    const desabonner = jeu.ecouterCarte((evenement, donnees) => {
      switch (evenement) {
        case EVENEMENTS.PION_POSITION:
          return moteur.positionPion(donnees.idPion, donnees.x, donnees.y);
        case EVENEMENTS.BROUILLARD_TRAIT_AJOUTE:
          return moteur.ajouterTrait(donnees.trait);
        case EVENEMENTS.SCENE_GRILLE_MAJ:
          return moteur.majGrille(donnees.grille);
        case EVENEMENTS.CARTE_PING_RECU:
          return moteur.afficherPing(donnees.x, donnees.y, donnees.couleur, donnees.par);
        case EVENEMENTS.DESSIN_AJOUTE:
          return moteur.ajouterMorceauTrace(donnees as Trace);
        case EVENEMENTS.DESSINS_ETAT:
          return moteur.chargerTraces(donnees.traces as Trace[]);
        case EVENEMENTS.COMBAT_TEXTE: {
          const { idPersonnage, ...texte } = donnees as TexteCombat;
          return moteur.afficherTexteCombat(idPersonnage, texte);
        }
      }
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

  // 4. L'outil et la couleur choisis dans la barre d'outils de la carte.
  useEffect(() => {
    if (!carte.moteur) return;
    carte.moteur.choisirOutil(outil);
    carte.moteur.couleurTrace = couleurTrace;
  }, [outil, couleurTrace]);

  return (
    <div className="monde">
      <canvas ref={refCanvas} />
    </div>
  );
}
