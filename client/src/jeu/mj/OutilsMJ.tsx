// Les outils du Maitre du Jeu ("God mode"), dans la MEME interface que les
// joueurs. Ce module n'est telecharge que par le navigateur du MJ (voir
// EcranJeu : import "paresseux"). Chaque outil s'insere dans la couche qui lui
// revient (portails React) : les fenetres avec les autres fenetres (le clic
// fait passer devant), le menu contextuel dans la couche modale. (Les boutons
// des outils sont sur la barre d'actions du MJ : voir OutilsBarreMJ.ts.)
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useJeu } from "@/core/jeu";
import { useEchelleInterface } from "@/core/useEchelleInterface";
import { Bestiaire } from "./Bestiaire";
import { FenetreAttaques } from "./FenetreAttaques";
import { FenetreCarte } from "./FenetreCarte";
import { FenetreCompendium } from "./FenetreCompendium";
import { MenuMJ } from "./MenuMJ";

export default function OutilsMJ() {
  const fenetres = useJeu((e) => e.fenetres);
  const { largeur } = useEchelleInterface();
  const [couches, setCouches] = useState<{ fenetres: Element; modale: Element } | null>(null);

  // Les couches de l'ecran de jeu existent deja (ce module arrive apres coup).
  useEffect(() => {
    const fenetresDom = document.querySelector(".fenetres");
    const modale = document.querySelector(".couche-modale");
    if (fenetresDom && modale) setCouches({ fenetres: fenetresDom, modale });
  }, []);
  if (!couches) return null;

  return (
    <>
      {createPortal(
        <>
          {fenetres.bestiaire && <Bestiaire position={{ x: 420, y: 120 }} />}
          {fenetres.compendium && <FenetreCompendium position={{ x: 520, y: 160 }} />}
          {fenetres.carteMJ && <FenetreCarte position={{ x: largeur - 1000, y: 110 }} />}
          {fenetres.attaques && <FenetreAttaques position={{ x: 470, y: 130 }} />}
        </>,
        couches.fenetres,
      )}
      {createPortal(<MenuMJ />, couches.modale)}
    </>
  );
}
