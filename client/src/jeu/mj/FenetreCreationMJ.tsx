import { EVENEMENTS } from "@partage/protocole.js";
import { methodesDeLaTable } from "@partage/creation.js";
import { jeu, useJeu } from "@/core/jeu";
import type { MethodeCaracteristiques } from "@/core/types";
import { Fenetre } from "@/ui/Fenetre";

const NOMS: Record<MethodeCaracteristiques, string> = {
  "tableau-standard": "Tableau standard (15, 14, 13, 12, 10, 8)",
  "achat-de-points": "Achat de points (27 points)",
  "tirage-4d6": "Des : 4d6, on garde les 3 meilleurs",
};

const total = (v: number[]) => v.reduce((a, b) => a + b, 0);

/**
 * La fenetre "Creation" du MJ (outil de sa barre) :
 *  - les methodes de caracteristiques permises a cette table ;
 *  - les tirages aux des des joueurs qui creent leur personnage, avec le
 *    bouton qui leur autorise une relance (ils gardent le meilleur tirage).
 */
export function FenetreCreationMJ({ position }: { position: { x: number; y: number } }) {
  const table = useJeu((e) => e.table);
  const regles = useJeu((e) => e.referentiel?.creation);
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, creationMJ: false } }));
  if (!table || !regles) return null;

  const permises = methodesDeLaTable(regles, table.reglages) as MethodeCaracteristiques[];
  const basculer = async (m: MethodeCaracteristiques) => {
    const suite = permises.includes(m) ? permises.filter((x) => x !== m) : regles.methodes.filter((x) => x === m || permises.includes(x));
    if (!suite.length) return jeu.journaliser("Garde au moins une methode de caracteristiques.", "erreur");
    // Toutes cochees = "toutes celles du referentiel" (null).
    const r = await jeu.demander(EVENEMENTS.TABLE_REGLER, { methodes: suite.length === regles.methodes.length ? null : suite });
    if (!r.ok) jeu.journaliser(r.erreur ?? "Refus du serveur.", "erreur");
  };
  const autoriser = async (pseudo: string) => {
    const r = await jeu.demander(EVENEMENTS.CREATION_AUTORISER_RELANCE, { pseudo });
    jeu.journaliser(r.ok ? `${pseudo} peut relancer ses des : le meilleur des deux tirages sera garde.` : (r.erreur ?? "Refus du serveur."), r.ok ? "systeme" : "erreur");
  };
  const tirages = Object.values(table.tirages ?? {});

  return (
    <Fenetre titre="Creation des personnages" classe="creation-mj" positionInitiale={position} surFermer={fermer}>
      <section className="creation-mj__section">
        <h3 className="creation-mj__titre">Methodes permises a cette table</h3>
        {regles.methodes.map((m) => (
          <label key={m} className="creation-mj__case">
            <input type="checkbox" checked={permises.includes(m)} onChange={() => basculer(m)} /> {NOMS[m] ?? m}
          </label>
        ))}
      </section>
      <section className="creation-mj__section">
        <h3 className="creation-mj__titre">Tirages aux des en cours</h3>
        {tirages.length === 0 && <p className="creation-mj__vide">Aucun joueur n'a encore tire ses caracteristiques.</p>}
        {tirages.map((t) => {
          const garde = t.tirages[t.retenu];
          return (
            <div key={t.pseudo} className="creation-mj__tirage">
              <div>
                <b>{t.pseudo}</b> : {[...garde].sort((a, b) => b - a).join(", ")} (total {total(garde)})
                {t.tirages.length > 1 && <span className="creation-mj__vide"> - {t.tirages.length} tirages, le meilleur est garde</span>}
              </div>
              <button type="button" className="bouton" disabled={t.relanceAutorisee} onClick={() => autoriser(t.pseudo)}>
                {t.relanceAutorisee ? "Relance autorisee" : "Autoriser une relance"}
              </button>
            </div>
          );
        })}
      </section>
    </Fenetre>
  );
}
