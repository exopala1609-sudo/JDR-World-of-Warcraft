import { useEffect } from "react";
import { jeu, useJeu } from "@/core/jeu";
import { useEchelleInterface } from "@/core/useEchelleInterface";
import { BarreActions, RACCOURCIS, utiliserRaccourci } from "@/jeu/BarreActions";
import { Bandeau } from "@/jeu/Bandeau";
import { CadresGroupe } from "@/jeu/CadresGroupe";
import { FenetreButin } from "@/jeu/FenetreButin";
import { CarteMonde } from "@/jeu/CarteMonde";
import { Discussion } from "@/jeu/Discussion";
import { FichePersonnage } from "@/jeu/FichePersonnage";
import { MicroMenu } from "@/jeu/MicroMenu";
import { Minicarte } from "@/jeu/Minicarte";
import { Sacs } from "@/jeu/Sacs";
import { CoucheGlisser } from "@/ui/glisser";
import { CoucheInfobulle } from "@/ui/InfoBulle";

/**
 * L'ecran de jeu, en couches superposees :
 *   1. le monde (Canvas de la carte)      - recoit les clics "dans le vide"
 *   2. le HUD (cadres fixes)              - transparent aux clics, sauf ses cadres
 *   3. les fenetres (sacs, personnage)    - idem
 *   4. l'infobulle                        - ne capte jamais la souris
 */
export function EcranJeu() {
  const fenetres = useJeu((e) => e.fenetres);
  const { largeur, hauteur } = useEchelleInterface();

  // Raccourcis clavier facon WoW. Ignores pendant qu'on ecrit dans un champ.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (cible.closest("input, textarea, select") || e.ctrlKey || e.altKey || e.metaKey) return;
      const touche = e.key.toLowerCase();
      const basculer = (nom: "sacs" | "personnage") =>
        jeu.modifier((etat) => ({ fenetres: { ...etat.fenetres, [nom]: !etat.fenetres[nom] } }));
      if (touche === "b") basculer("sacs");
      else if (touche === "c") basculer("personnage");
      else if (touche === "escape") {
        jeu.fermerButin();
        jeu.modifier({ fenetres: { sacs: false, personnage: false } });
      } else if (RACCOURCIS.includes(e.key)) utiliserRaccourci(RACCOURCIS.indexOf(e.key)); // touches 1 a =
      else if (touche === "enter") document.getElementById("saisie-discussion")?.focus();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  return (
    <>
      <CarteMonde />
      <div className="hud">
        <CadresGroupe />
        <Bandeau />
        <Minicarte />
        <Discussion />
        <BarreActions />
        <MicroMenu />
      </div>
      <div className="fenetres">
        {fenetres.personnage && <FichePersonnage position={{ x: 560, y: 150 }} />}
        {fenetres.sacs && <Sacs position={{ x: largeur - 420, y: hauteur - 560 }} />}
        <FenetreButin />
      </div>
      <CoucheInfobulle />
      <CoucheGlisser />
    </>
  );
}
