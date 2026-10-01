// Les outils du Maitre du Jeu ("God mode"), dans la MEME interface que les
// joueurs. Ce module n'est telecharge que par le navigateur du MJ (voir
// EcranJeu : import "paresseux"). Chaque outil s'insere dans la couche qui lui
// revient (portails React) : les fenetres avec les autres fenetres (le clic
// fait passer devant), le menu contextuel dans la couche modale, la barre
// d'outils dans le HUD.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useJeu } from "@/core/jeu";
import { useEchelleInterface } from "@/core/useEchelleInterface";
import { BarreMJ } from "./BarreMJ";
import { Bestiaire } from "./Bestiaire";
import { FenetreCarte } from "./FenetreCarte";
import { FenetreCompendium } from "./FenetreCompendium";
import { MenuMJ } from "./MenuMJ";

export default function OutilsMJ() {
  const fenetres = useJeu((e) => e.fenetres);
  const { largeur } = useEchelleInterface();
  const [couches, setCouches] = useState<{ hud: Element; fenetres: Element; modale: Element } | null>(null);

  // Les couches de l'ecran de jeu existent deja (ce module arrive apres coup).
  useEffect(() => {
    const hud = document.querySelector(".hud");
    const fenetresDom = document.querySelector(".fenetres");
    const modale = document.querySelector(".couche-modale");
    if (hud && fenetresDom && modale) setCouches({ hud, fenetres: fenetresDom, modale });
  }, []);
  if (!couches) return null;

  return (
    <>
      {createPortal(<BarreMJ />, couches.hud)}
      {createPortal(
        <>
          {fenetres.bestiaire && <Bestiaire position={{ x: 420, y: 120 }} />}
          {fenetres.compendium && <FenetreCompendium position={{ x: 520, y: 160 }} />}
          {fenetres.carteMJ && <FenetreCarte position={{ x: largeur - 1000, y: 110 }} />}
        </>,
        couches.fenetres,
      )}
      {createPortal(<MenuMJ />, couches.modale)}
    </>
  );
}
