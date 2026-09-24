import { avecInfobulle } from "@/ui/InfoBulle";

const RACCOURCIS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];

/** Bas centre : 12 emplacements de raccourcis, encadres de deux griffons. */
export function BarreActions() {
  return (
    <div className="actions">
      <div className="actions__embleme actions__embleme--gauche" />
      <div className="actions__barre cadre">
        {RACCOURCIS.map((touche) => (
          <div
            key={touche}
            className="case"
            {...avecInfobulle(() => (
              <>
                <div className="infobulle__titre">Emplacement {touche}</div>
                <div className="infobulle__ligne--gris">Vide. Tu pourras bientot y glisser tes sorts.</div>
              </>
            ))}
          >
            <span className="actions__raccourci">{touche}</span>
          </div>
        ))}
      </div>
      <div className="actions__embleme actions__embleme--droite" />
    </div>
  );
}
