import { PALETTE_TRACES } from "@partage/couleurs.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import type { OutilCarte } from "@/core/types";
import { avecInfobulle } from "@/ui/InfoBulle";

const OUTILS: { outil: OutilCarte; symbole: string; nom: string; aide: string }[] = [
  { outil: "deplacer", symbole: "✋", nom: "Deplacer", aide: "Glisser votre pion. Clic droit maintenu : deplacer la vue." },
  { outil: "tracer", symbole: "✎", nom: "Tracer", aide: "Dessiner un chemin ou une fleche d'attaque, visible de toute la table." },
  { outil: "ping", symbole: "◎", nom: "Ping", aide: "Attirer l'attention sur une case. Raccourci : Alt + clic, avec n'importe quel outil." },
];

// Outils du MJ seulement : peindre le brouillard (le serveur refuse les joueurs).
const OUTILS_MJ: typeof OUTILS = [
  { outil: "gomme", symbole: "☀", nom: "Reveler (gomme)", aide: "Effacer le brouillard : les joueurs decouvrent cette zone." },
  { outil: "pinceau", symbole: "☁", nom: "Cacher (pinceau)", aide: "Repeindre le brouillard sur une zone." },
];

/** Sous la minicarte : les outils de la carte (deplacer, tracer, pinguer ; MJ : brouillard). */
export function OutilsCarte() {
  const outil = useJeu((e) => e.outil);
  const couleurTrace = useJeu((e) => e.couleurTrace);
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const rayonPinceau = useJeu((e) => e.rayonPinceau);
  const maCouleur = jeu.maCouleur();

  const effacer = (tout: boolean) => jeu.demander(EVENEMENTS.DESSIN_EFFACER, { tout });

  return (
    <div className="outils-carte cadre">
      <div className="outils-carte__rangee">
        {[...OUTILS, ...(estMJ ? OUTILS_MJ : [])].map((o) => (
          <button
            key={o.outil}
            type="button"
            className={`outils-carte__bouton${outil === o.outil ? " outils-carte__bouton--actif" : ""}`}
            onClick={() => jeu.modifier({ outil: o.outil })}
            aria-label={o.nom}
            {...avecInfobulle(() => (
              <>
                <div className="infobulle__titre">{o.nom}</div>
                <div className="infobulle__ligne--or">{o.aide}</div>
              </>
            ))}
          >
            {o.symbole}
          </button>
        ))}
        <button
          type="button"
          className="outils-carte__bouton"
          onClick={() => effacer(false)}
          aria-label="Effacer mes traces"
          {...avecInfobulle(() => <div>Effacer mes traces</div>)}
        >
          ⌫
        </button>
        {estMJ && (
          <button
            type="button"
            className="outils-carte__bouton"
            onClick={() => effacer(true)}
            aria-label="Effacer toutes les traces"
            {...avecInfobulle(() => <div>Effacer les traces de toute la table (MJ)</div>)}
          >
            ✖
          </button>
        )}
      </div>

      {estMJ && (outil === "gomme" || outil === "pinceau") && (
        <label className="outils-carte__rangee outils-carte__rayon">
          Taille
          <input type="range" min={10} max={400} value={rayonPinceau} onChange={(e) => jeu.modifier({ rayonPinceau: Number(e.target.value) })} />
        </label>
      )}
      {outil === "tracer" && (
        <div className="outils-carte__rangee outils-carte__palette">
          {[null, ...PALETTE_TRACES].map((couleur) => (
            <button
              key={couleur ?? "moi"}
              type="button"
              className={`outils-carte__couleur${couleurTrace === couleur ? " outils-carte__couleur--active" : ""}${couleur === null ? " outils-carte__couleur--moi" : ""}`}
              style={{ background: couleur ?? maCouleur }}
              onClick={() => jeu.modifier({ couleurTrace: couleur })}
              aria-label={couleur ?? "Ma couleur"}
              {...avecInfobulle(() => <div>{couleur === null ? "Ma couleur (celle de mon pion)" : couleur}</div>)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
