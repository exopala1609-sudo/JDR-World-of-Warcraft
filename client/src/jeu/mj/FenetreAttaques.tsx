import { useState, type CSSProperties } from "react";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone } from "@/core/medias";
import { useTexture } from "@/core/textures";
import { Fenetre } from "@/ui/Fenetre";
import { avecInfobulle } from "@/ui/InfoBulle";

const NOM_DU_RANG: Record<string, string> = { elite: "Elite", rare: "Rare", boss: "Boss" };

/**
 * MJ : les attaques d'un monstre (clic droit sur son pion > Attaques). Le
 * portrait du monstre dans le medaillon, ses attaques dans les cases (2
 * colonnes de 7, comme le panneau des capacites de WoW : UI-AbilityPanel).
 * Un clic sur une attaque la lance : la fenetre de resolution des des s'ouvre
 * (jet secret si le monstre est cache aux joueurs). La fenetre reste ouverte
 * pour enchainer les attaques.
 */
export function FenetreAttaques({ position }: { position: { x: number; y: number } }) {
  const p = useJeu((e) => (e.attaquant ? e.personnages[e.attaquant] : undefined));
  const pion = useJeu((e) => (e.attaquant ? e.scene?.pions.find((x) => x.idPersonnage === e.attaquant) : undefined));
  const texture = Boolean(useTexture("panneau-attaques"));
  const [imageAbsente, setImageAbsente] = useState(false);
  const fermer = () => jeu.modifier((e) => ({ attaquant: null, fenetres: { ...e.fenetres, attaques: false } }));
  if (!p) return null;

  const image = pion?.image && !imageAbsente ? `/medias/${pion.image.split("/").map(encodeURIComponent).join("/")}?remplacement=non` : null;
  const initiales = p.nom
    .split(/\s+/)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const rang = p.rang && NOM_DU_RANG[p.rang] ? ` - ${NOM_DU_RANG[p.rang]}` : "";

  return (
    <Fenetre titre={p.nom} classe={`attaques${texture ? " attaques--panneau" : ""}`} positionInitiale={position} surFermer={fermer}>
      <div className="attaques__portrait">{image ? <img src={image} alt="" onError={() => setImageAbsente(true)} /> : <span>{initiales}</span>}</div>
      <p className="attaques__sous-titre">
        Niveau {p.niveau}
        {rang}
        {pion?.cache ? " - cache (jets secrets)" : ""}
      </p>
      <div className="attaques__liste">
        {p.attaquesMonstre.map((a, i) => (
          <button
            key={a.nom}
            type="button"
            className="attaques__case"
            style={{ "--col": i % 2, "--rang": Math.floor(i / 2) } as CSSProperties}
            onClick={() => jeu.attaquerMonstre(p.id, a.nom)}
            {...avecInfobulle(() => (
              <>
                <div className="infobulle__titre">{a.nom}</div>
                <div>
                  Toucher {a.toucher >= 0 ? "+" : ""}
                  {a.toucher}
                </div>
                <div>
                  Degats {a.degats} {a.type}
                </div>
                <div className="infobulle__ligne--vert">Clic : attaquer (la fenetre des des s'ouvre).</div>
              </>
            ))}
          >
            <span className="case attaques__icone">
              <img src={urlIcone(a.nom)} alt="" />
            </span>
            <span className="attaques__texte">
              <span className="attaques__nom">{a.nom}</span>
              <span className="attaques__detail">
                {a.toucher >= 0 ? "+" : ""}
                {a.toucher} - {a.degats} {a.type}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="attaques__aide">Clic sur une attaque : jet d'attaque et degats.</p>
    </Fenetre>
  );
}
