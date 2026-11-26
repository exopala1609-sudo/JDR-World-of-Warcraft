import { useState, type CSSProperties } from "react";
import { jeu, useJeu } from "@/core/jeu";
import { urlPortrait } from "@/core/medias";
import { rolePortrait, useTextures, type RoleTexture } from "@/core/textures";
import type { Rang } from "@/core/types";
import { couleurRessource, ressourcePrincipale } from "@/jeu/CadresGroupe";
import { Barre } from "@/ui/Barre";
import { avecInfobulle, versScene } from "@/ui/InfoBulle";

const TEXTURE_DU_RANG: Record<Rang, RoleTexture> = {
  normal: "cible-normal",
  elite: "cible-elite",
  rare: "cible-rare",
  boss: "cible-boss",
};
const NOM_DU_RANG: Record<Rang, string> = { normal: "", elite: "Elite", rare: "Rare", boss: "Boss" };

/**
 * Le cadre de cible, facon WoW : en haut, a droite des cadres du groupe. Il
 * montre ce qu'on a cible (clic sur un pion ou un cadre ; Echap l'efface).
 *  - Un heros, ou n'importe qui pour le MJ : la fiche (PV exacts, ressource).
 *  - Un monstre, pour un joueur : il n'a PAS sa fiche (secret du MJ). Le
 *    serveur ne lui donne que son nom, son niveau, son rang et sa sante
 *    arrondie a 10 % (comme la barre de vie d'une cible dans WoW).
 * Le cadre change selon le rang : normal, elite (dragon dore), rare (dragon
 * d'argent), boss (TargetFrame*, UnitFrameBoss du dossier interface/).
 */
export function CadreCible() {
  const idCible = useJeu((e) => e.cible);
  const personnage = useJeu((e) => (e.cible ? e.personnages[e.cible] : undefined));
  const pion = useJeu((e) => (e.cible ? e.scene?.pions.find((p) => p.idPersonnage === e.cible) : undefined));
  const textures = useTextures();
  const [imageAbsente, setImageAbsente] = useState<string | null>(null);
  if (!idCible || (!personnage && !pion)) return null;

  const nom = personnage?.nom ?? pion!.nom;
  const monstre = (personnage?.proprietaire ?? pion?.proprietaire ?? null) === null;
  const rang: Rang = (personnage?.rang ?? pion?.rang ?? "normal") as Rang;
  const niveau = personnage?.niveau ?? pion?.niveau;
  const texture = textures[TEXTURE_DU_RANG[rang]] ?? (rang !== "normal" ? textures["cible-normal"] : undefined);
  const ressource = personnage ? ressourcePrincipale(personnage) : null;

  // Le portrait : l'image du pion (jeton, icone), sinon celle du dossier portraits/,
  // sinon le portrait provisoire de WoW (race + sexe), sinon les initiales.
  const sources = [
    pion?.image ? `/medias/${pion.image.split("/").map(encodeURIComponent).join("/")}?remplacement=non` : null,
    personnage && !monstre ? `${personnage.portrait ? `/medias/portraits/${encodeURIComponent(personnage.portrait)}` : urlPortrait(nom)}?remplacement=non` : null,
    personnage ? textures[rolePortrait(personnage.race, personnage.sexe) ?? "fond-"] : null,
  ].filter((s): s is string => Boolean(s) && s !== imageAbsente);
  const image = sources[0];
  const initiales = nom
    .split(/\s+/)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const classes = ["cadre-cible", `cadre-cible--${rang}`, monstre ? "cadre-cible--hostile" : "cadre-cible--amical", texture ? "cadre-cible--texture" : "cadre"];
  return (
    <div
      className={classes.join(" ")}
      style={texture ? ({ "--fond-cible": `url("${texture}")` } as CSSProperties) : undefined}
      // Clic droit (MJ) : le meme menu que sur le pion (PV, etats...).
      onContextMenu={(e) => {
        if (!jeu.estMJ()) return;
        e.preventDefault();
        jeu.modifier({ menu: { idPersonnage: idCible, ...versScene(e.clientX, e.clientY) } });
      }}
      {...avecInfobulle(() => (
        <>
          <div className={`infobulle__titre ${monstre ? "infobulle__ligne--rouge" : "infobulle__ligne--or"}`}>{nom}</div>
          <div className="infobulle__ligne--gris">
            {niveau ? `Niveau ${niveau}` : "Niveau ??"}
            {NOM_DU_RANG[rang] ? ` - ${NOM_DU_RANG[rang]}` : ""}
          </div>
          <div className="infobulle__ligne--gris">Echap : ne plus cibler.</div>
        </>
      ))}
    >
      <div className="cadre-cible__nom">
        <span>{nom}</span>
      </div>
      {personnage ? (
        <Barre classe="barre--vie cadre-cible__vie" actuel={personnage.pointsDeVie.actuels} max={personnage.pointsDeVie.max} texte={`${personnage.pointsDeVie.actuels} / ${personnage.pointsDeVie.max}`} />
      ) : (
        <Barre classe="barre--vie cadre-cible__vie" actuel={pion?.sante ?? 100} max={100} texte={`${pion?.sante ?? 100} %`} />
      )}
      <div className="cadre-cible__ressource">
        {ressource && <Barre classe="barre--ressource" actuel={ressource.actuel} max={ressource.max} couleur={couleurRessource(ressource)} texte="" />}
      </div>
      {rang !== "boss" || !texture ? (
        <div className="cadre-cible__portrait">
          {image ? <img src={image} alt="" onError={() => setImageAbsente(image)} /> : <span className="cadre-cible__initiales">{initiales}</span>}
        </div>
      ) : null}
      <div className="cadre-cible__niveau" title={NOM_DU_RANG[rang] || undefined}>
        {niveau ?? "??"}
      </div>
      {!texture && NOM_DU_RANG[rang] && <div className="cadre-cible__rang">{NOM_DU_RANG[rang]}</div>}
    </div>
  );
}
