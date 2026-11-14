import type { CSSProperties } from "react";
import { jeu, useJeu, type EtatJeu } from "@/core/jeu";
import { useTexture, type RoleTexture } from "@/core/textures";
import { ReglageSon } from "@/jeu/ReglageSon";
import { avecInfobulle } from "@/ui/InfoBulle";

/**
 * Un bouton du micro-menu. Si sa texture de WoW est dans le dossier interface/
 * (ex. UI-MicroButton-Quest-Up), il la porte, avec son etat "enfonce" (-Down)
 * quand on clique ou que sa fenetre est ouverte. Sinon : une lettre.
 */
function BoutonMicro(props: { libelle: string; aide: string; action: () => void; actif?: boolean; role: RoleTexture; icone?: RoleTexture }) {
  const { libelle, aide, action, actif = false, role, icone } = props;
  // Une icone choisie (ex. UI-Battlefield-Icon pour l'initiative) passe devant le micro-bouton.
  const imageIcone = useTexture(icone ?? role);
  const microHaut = useTexture(role);
  const microBas = useTexture(`${role}-appui` as RoleTexture) ?? microHaut;
  const avecIcone = Boolean(icone && imageIcone);
  const haut = avecIcone ? imageIcone : microHaut;
  const bas = avecIcone ? imageIcone : microBas;
  const style = haut ? ({ "--micro": `url("${haut}")`, "--micro-appui": `url("${bas}")` } as CSSProperties) : undefined;
  const forme = !haut ? "" : avecIcone ? " menu__bouton--icone" : role === "sac" ? " menu__bouton--sac" : " menu__bouton--texture";
  return (
    <button
      type="button"
      className={`menu__bouton${forme}${actif ? " menu__bouton--actif" : ""}`}
      style={style}
      onClick={action}
      aria-label={aide}
      {...avecInfobulle(() => <div>{aide}</div>)}
    >
      {haut ? null : libelle}
    </button>
  );
}

/** Bas droite : les petits boutons du micro-menu de WoW. */
export function MicroMenu() {
  const fenetres = useJeu((e) => e.fenetres);
  const basculer = (nom: keyof EtatJeu["fenetres"]) =>
    jeu.modifier((e) => ({ fenetres: { ...e.fenetres, [nom]: !e.fenetres[nom] } }));

  return (
    <div className="menu cadre">
      <BoutonMicro libelle="C" aide="Personnage (C)" role="micro-personnage" action={() => basculer("personnage")} actif={fenetres.personnage} />
      <BoutonMicro libelle="P" aide="Grimoire (P)" role="micro-grimoire" action={() => basculer("grimoire")} actif={fenetres.grimoire} />
      <BoutonMicro libelle="L" aide="Journal de quetes (L)" role="micro-quetes" action={() => basculer("quetes")} actif={fenetres.quetes} />
      <BoutonMicro libelle="I" aide="Initiative (I)" role="micro-initiative" icone="icone-initiative" action={() => basculer("initiative")} actif={fenetres.initiative} />
      <BoutonMicro libelle="N" aide="Carnet de notes (N)" role="micro-carnet" action={() => basculer("carnet")} actif={fenetres.carnet} />
      <BoutonMicro libelle="B" aide="Sacs (B)" role="sac" action={() => basculer("sacs")} actif={fenetres.sacs} />
      <ReglageSon />
      <BoutonMicro libelle="X" aide="Quitter la partie" role="micro-quitter" action={() => jeu.deconnecter()} />
    </div>
  );
}
