import { useState } from "react";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu, type EtatJeu } from "@/core/jeu";
import { avecInfobulle } from "@/ui/InfoBulle";

const CLE_REPLIEE = "vtt-barre-mj-repliee";

type Outil = { cle: string; symbole: string; nom: string; aide: string; fenetre?: keyof EtatJeu["fenetres"]; action?: () => void };

/**
 * La barre d'outils du MJ : un panneau vertical, accroche au bord droit de
 * l'ecran, qui se replie en un simple onglet "MJ". Chaque bouton ouvre un
 * outil (Bestiaire, Compendium, Initiative, Carte) ou agit sur la table.
 */
export function BarreMJ() {
  const fenetres = useJeu((e) => e.fenetres);
  const [repliee, setRepliee] = useState(() => {
    try {
      return localStorage.getItem(CLE_REPLIEE) === "1";
    } catch {
      return false;
    }
  });
  const [confirmerRepos, setConfirmerRepos] = useState(false);

  const replier = (valeur: boolean) => {
    setRepliee(valeur);
    try {
      localStorage.setItem(CLE_REPLIEE, valeur ? "1" : "0");
    } catch {
      /* preference non memorisee */
    }
  };
  const basculer = (nom: keyof EtatJeu["fenetres"]) => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, [nom]: !e.fenetres[nom] } }));

  const recharger = async () => {
    const [c, r] = await Promise.all([jeu.demander(EVENEMENTS.COMPENDIUM_RECHARGER), jeu.demander(EVENEMENTS.REFERENTIEL_RECHARGER)]);
    if (r.ok) jeu.journaliser("Referentiel recharge (races, classes...).");
    if (!c.ok && !r.ok) jeu.journaliser("Rechargement impossible.", "erreur");
  };

  const OUTILS: Outil[] = [
    { cle: "bestiaire", symbole: "☠", nom: "Bestiaire", aide: "Les monstres du compendium : glisse-les sur la carte.", fenetre: "bestiaire" },
    { cle: "compendium", symbole: "✦", nom: "Compendium", aide: "Objets, sorts, auras : les donner a un personnage ou les mettre dans un coffre.", fenetre: "compendium" },
    { cle: "initiative", symbole: "⚔", nom: "Initiative", aide: "Lancer et mener le combat (touche I).", fenetre: "initiative" },
    { cle: "carte", symbole: "⌖", nom: "Carte", aide: "Image de fond, grille, brouillard.", fenetre: "carteMJ" },
    {
      cle: "repos",
      symbole: "☾",
      nom: confirmerRepos ? "Confirmer ?" : "Repos long",
      aide: "Repos long pour toute la table (PV, ressources). Deux clics pour confirmer.",
      action: () => {
        if (!confirmerRepos) return setConfirmerRepos(true);
        setConfirmerRepos(false);
        jeu.demander(EVENEMENTS.REPOS_LONG, {});
      },
    },
    { cle: "recharger", symbole: "↻", nom: "Recharger", aide: "Relire les fichiers du compendium et du referentiel apres les avoir modifies.", action: recharger },
  ];

  if (repliee) {
    return (
      <button type="button" className="barre-mj barre-mj--repliee cadre" onClick={() => replier(false)} {...avecInfobulle(() => <div>Outils du Maitre du Jeu</div>)}>
        MJ
      </button>
    );
  }
  return (
    <nav className="barre-mj cadre" aria-label="Outils du Maitre du Jeu" onPointerLeave={() => setConfirmerRepos(false)}>
      <div className="barre-mj__entete">
        <span className="titre-or">MJ</span>
        <button type="button" className="barre-mj__replier" onClick={() => replier(true)} aria-label="Replier">
          ›
        </button>
      </div>
      {OUTILS.map((o) => (
        <button
          key={o.cle}
          type="button"
          className={`barre-mj__outil${o.fenetre && fenetres[o.fenetre] ? " barre-mj__outil--actif" : ""}`}
          onClick={() => (o.fenetre ? basculer(o.fenetre) : o.action?.())}
          {...avecInfobulle(() => (
            <>
              <div className="infobulle__titre">{o.nom}</div>
              <div className="infobulle__ligne--or">{o.aide}</div>
            </>
          ))}
        >
          <span className="barre-mj__symbole">{o.symbole}</span>
          <span className="barre-mj__nom">{o.nom}</span>
        </button>
      ))}
    </nav>
  );
}
