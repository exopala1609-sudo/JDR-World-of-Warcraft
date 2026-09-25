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

/** Sous la minicarte : les outils de la carte (deplacer, tracer, pinguer). */
export function OutilsCarte() {
  const outil = useJeu((e) => e.outil);
  const couleurTrace = useJeu((e) => e.couleurTrace);
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const maCouleur = jeu.maCouleur();

  const effacer = (tout: boolean) => jeu.demander(EVENEMENTS.DESSIN_EFFACER, { tout });

  return (
    <div className="outils-carte cadre">
      <div className="outils-carte__rangee">
        {OUTILS.map((o) => (
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
