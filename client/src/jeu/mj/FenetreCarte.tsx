import { useEffect, useRef, useState } from "react";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import type { Scene } from "@/core/types";
import { Fenetre } from "@/ui/Fenetre";

type Grille = Scene["grille"];

/** Un curseur + sa valeur exacte (saisissable), pour regler la grille au pixel pres. */
function Reglage({ libelle, valeur, min, max, pas, surChange }: { libelle: string; valeur: number; min: number; max: number; pas: number; surChange: (v: number) => void }) {
  return (
    <label className="carte-mj__reglage">
      <span>{libelle}</span>
      <input type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => surChange(Number(e.target.value))} />
      <input className="champ carte-mj__nombre" type="number" min={min} max={max} step={pas} value={valeur} onChange={(e) => surChange(Number(e.target.value))} />
    </label>
  );
}

/**
 * La fenetre "Carte" du MJ (bouton sur le bord de la minicarte) :
 *  - l'image de fond : une de ton dossier cartes/, ou une nouvelle que tu
 *    televerses (elle est ecrite dans cartes/ de ton cloud) ;
 *  - la grille : taille des cases et decalage, en direct chez tout le monde ;
 *  - le brouillard et les pions.
 */
export function FenetreCarte({ position }: { position: { x: number; y: number } }) {
  const scene = useJeu((e) => e.scene);
  const [cartes, setCartes] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [grille, setGrille] = useState<Grille | null>(scene?.grille ?? null);
  const refFichier = useRef<HTMLInputElement>(null);
  const minuterie = useRef<number | null>(null);
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, carteMJ: false } }));

  const lister = () => jeu.demander(EVENEMENTS.MEDIAS_LISTER, { categorie: "cartes" }).then((r) => r.ok && setCartes(r.fichiers as string[]));
  useEffect(() => {
    lister();
  }, []);
  // La grille affichee suit celle du serveur (un autre onglet MJ a pu la changer).
  useEffect(() => {
    if (scene && minuterie.current === null) setGrille(scene.grille);
  }, [scene?.grille]);

  if (!scene || !grille) return null;

  // Reglage de grille : on montre tout de suite, on envoie au plus ~8 fois par seconde.
  const regler = (changement: Partial<Grille>) => {
    const nouvelle = { ...grille, ...changement };
    setGrille(nouvelle);
    if (minuterie.current !== null) clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => {
      minuterie.current = null;
      jeu.demander(EVENEMENTS.SCENE_GRILLE, nouvelle);
    }, 120);
  };

  const choisir = (fichier: string | null) => jeu.demander(EVENEMENTS.SCENE_CARTE, { fichier });
  const televerser = async (fichier: File) => {
    setEnvoi(`Envoi de ${fichier.name}...`);
    const r = await jeu.televerserCarte(fichier);
    setEnvoi(r.erreur ?? null);
    if (r.fichier) {
      await lister();
      await choisir(r.fichier);
    }
  };

  return (
    <Fenetre titre="Carte" classe="carte-mj" positionInitiale={position} surFermer={fermer}>
      <section className="carte-mj__section">
        <h3 className="carte-mj__titre">Image de fond</h3>
        <div className="carte-mj__vignettes">
          <button type="button" className={`carte-mj__vignette${scene.carte.fichier === null ? " carte-mj__vignette--choisie" : ""}`} onClick={() => choisir(null)}>
            <span className="carte-mj__vide">Carte de test</span>
          </button>
          {cartes.map((f) => (
            <button
              key={f}
              type="button"
              className={`carte-mj__vignette${scene.carte.fichier === f ? " carte-mj__vignette--choisie" : ""}`}
              onClick={() => choisir(f)}
              title={f}
            >
              <img src={`/medias/cartes/${encodeURIComponent(f)}`} alt="" loading="lazy" />
              <span>{f}</span>
            </button>
          ))}
        </div>
        <div className="carte-mj__ligne">
          <button type="button" className="bouton" onClick={() => refFichier.current?.click()}>
            Televerser une image...
          </button>
          <input
            ref={refFichier}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              e.target.value = "";
              if (fichier) televerser(fichier);
            }}
          />
          <span className="carte-mj__astuce">{envoi ?? "png, jpg, webp ou gif (40 Mo max). Changer de carte remet le brouillard a zero."}</span>
        </div>
      </section>

      <section className="carte-mj__section">
        <h3 className="carte-mj__titre">Grille (1 case = 1,5 m)</h3>
        <Reglage libelle="Taille d'une case" valeur={grille.taille} min={20} max={300} pas={0.5} surChange={(taille) => regler({ taille })} />
        <Reglage libelle="Decalage horizontal" valeur={grille.decalageX} min={-150} max={150} pas={0.5} surChange={(decalageX) => regler({ decalageX })} />
        <Reglage libelle="Decalage vertical" valeur={grille.decalageY} min={-150} max={150} pas={0.5} surChange={(decalageY) => regler({ decalageY })} />
        <label className="carte-mj__case">
          <input type="checkbox" checked={grille.visible} onChange={(e) => regler({ visible: e.target.checked })} /> Grille visible
        </label>
      </section>

      <section className="carte-mj__section">
        <h3 className="carte-mj__titre">Brouillard et pions</h3>
        <div className="carte-mj__ligne">
          <button type="button" className="bouton bouton--discret" onClick={() => jeu.demander(EVENEMENTS.BROUILLARD_TOUT, { mode: "reveler" })}>
            Tout reveler
          </button>
          <button type="button" className="bouton bouton--discret" onClick={() => jeu.demander(EVENEMENTS.BROUILLARD_TOUT, { mode: "cacher" })}>
            Tout cacher
          </button>
          <label className="carte-mj__case">
            <input type="checkbox" checked={scene.brouillard.actif} onChange={(e) => jeu.demander(EVENEMENTS.BROUILLARD_ACTIF, { actif: e.target.checked })} /> Brouillard actif
          </label>
        </div>
        <div className="carte-mj__ligne">
          <button type="button" className="bouton bouton--discret" onClick={() => jeu.demander(EVENEMENTS.PIONS_PLACER_TOUS)}>
            Placer les personnages absents
          </button>
          <span className="carte-mj__astuce">Pinceau et gomme du brouillard : sous la minicarte.</span>
        </div>
      </section>
    </Fenetre>
  );
}
