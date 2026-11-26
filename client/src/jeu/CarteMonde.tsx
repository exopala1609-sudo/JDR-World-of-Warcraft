import { useEffect, useRef } from "react";
import { MoteurCarte } from "@partage/moteur-carte.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { carte } from "@/core/carte";
import { imagesDeRace, useTextures } from "@/core/textures";
import { jeu, useJeu } from "@/core/jeu";
import type { TexteCombat, Trace } from "@/core/types";
import { useEchelleInterface } from "@/core/useEchelleInterface";
import { useCible, type Charge, type PointLacher } from "@/ui/glisser";
import { versScene } from "@/ui/InfoBulle";

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
  const rayonPinceau = useJeu((e) => e.rayonPinceau);
  const { largeur, hauteur } = useEchelleInterface();
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  // Les textures (portraits de race des pions) arrivent apres la carte : on redessine.
  const textures = useTextures();
  useEffect(() => {
    if (carte.moteur) carte.moteur.sale = true;
  }, [textures]);

  // Zone de depot (MJ) : un monstre du Bestiaire, ou un coffre, lache sur la carte.
  const depot = useCible("carte", {
    accepte: (c: Charge) => estMJ && (c.origine === "bestiaire" || c.origine === "coffre"),
    deposer: (c: Charge, point: PointLacher) => {
      // Seulement si l'on a lache sur la carte elle-meme (pas sur la discussion posee dessus).
      if (document.elementFromPoint(point.clientX, point.clientY) !== refCanvas.current || !carte.moteur) {
        return jeu.journaliser("Lache le monstre sur la carte, pas sur un cadre de l'interface.", "erreur");
      }
      const { x, y } = carte.moteur.versCarte(point);
      if (c.origine === "bestiaire") jeu.demander(EVENEMENTS.BESTIAIRE_INVOQUER, { idMonstre: c.monstre.id, x, y, cache: jeu.lire().invocationCachee });
      if (c.origine === "coffre") jeu.demander(EVENEMENTS.BUTIN_CREER, { genre: "coffre", nom: "Coffre", x, y });
    },
  });

  // 1. Creation du moteur (une seule fois) et branchement sur le serveur.
  useEffect(() => {
    // Les chiffres de combat : Skurri (la police des degats de WoW) si elle est
    // dans le dossier polices/, sinon celle de l'interface. Un canvas ne
    // declenche pas le telechargement d'une police : on le demande nous-memes.
    const police = getComputedStyle(document.documentElement).getPropertyValue("--police-combat").trim() || "sans-serif";
    document.fonts?.load('20px "Skurri WoW"').catch(() => {});

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
      // Clic sur un coffre ou un cadavre : la fenetre de butin s'ouvre a cote du curseur.
      surButin: (butin: { id: string }, clientX: number, clientY: number) => jeu.ouvrirButin(butin.id, versScene(clientX, clientY)),
      // Clic sur un pion : il devient la cible (sa fiche avec C ; chez le MJ, sa barre en page 2).
      // Clic sur un pion : il devient la CIBLE (cadre de cible), et, si on a sa fiche, la selection.
      surSelection: (pion: { idPersonnage: string }) => {
        jeu.modifier({ cible: pion.idPersonnage, ...(jeu.lire().personnages[pion.idPersonnage] ? { selection: pion.idPersonnage } : {}) });
      },
      // MJ : un coffre / cadavre glisse ailleurs sur la carte.
      surDeplacementButin: (butin: { id: string }, x: number, y: number) => jeu.demander(EVENEMENTS.BUTIN_DEPLACER, { idButin: butin.id, x, y }),
      // Clic droit sur un pion (MJ) : le menu contextuel (PV, etats, cacher...).
      surMenuPion: (pion: { idPersonnage: string }, clientX: number, clientY: number) => {
        if (jeu.estMJ()) jeu.modifier({ menu: { idPersonnage: pion.idPersonnage, ...versScene(clientX, clientY) } });
      },
      // Gomme / pinceau du MJ : chaque morceau de trait part au serveur (qui le diffuse).
      surTrait: (trait: unknown) => jeu.demander(EVENEMENTS.BROUILLARD_TRAIT, trait),
      // Un heros sans jeton ni portrait : l'icone (ou le portrait) de sa race.
      imagesDeSecours: (pion: { idPersonnage: string; proprietaire: string | null }) => {
        const p = pion.proprietaire ? jeu.lire().personnages[pion.idPersonnage] : undefined;
        return p ? imagesDeRace(p.race, p.sexe) : [];
      },
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

  // 3 bis. Combat : le pion du combattant actif pulse (chez tout le monde).
  // (Un monstre cache est anonyme chez les joueurs : pas d'identifiant, pas de halo.)
  const idActif = useJeu((e) => (e.combat ? (e.combat.participants[e.combat.indexActif]?.idPersonnage ?? null) : null));
  useEffect(() => {
    carte.moteur?.definirActif(idActif);
  }, [idActif]);

  // 4. L'outil et la couleur choisis dans la barre d'outils de la carte.
  useEffect(() => {
    if (!carte.moteur) return;
    carte.moteur.choisirOutil(outil);
    carte.moteur.couleurTrace = couleurTrace;
    carte.moteur.rayonPinceau = rayonPinceau;
  }, [outil, couleurTrace, rayonPinceau]);

  return (
    <div className="monde" {...depot.proprietes}>
      <canvas ref={refCanvas} className={depot.survolee ? "monde__depot" : undefined} />
    </div>
  );
}
