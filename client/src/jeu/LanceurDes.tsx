import { useEffect, useState } from "react";
import { CARACTERISTIQUES, bonusDeTest } from "@partage/dnd5e.js";
import { NOMS_CARACTERISTIQUES } from "@partage/creation.js";
import { jeu, useJeu, type Avantage } from "@/core/jeu";
import { signe } from "@/core/journal";
import { FACES, FORMES, type Faces } from "@/ui/formesDes";
import { avecInfobulle } from "@/ui/InfoBulle";

function IconeDe({ faces }: { faces: Faces }) {
  return (
    <svg className="icone-de" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={FORMES[faces]} />
      <text x="50" y={faces === 4 ? 70 : 60} textAnchor="middle">
        {faces === 100 ? "%" : faces}
      </text>
    </svg>
  );
}

const VIDE: Record<Faces, number> = { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 };

/**
 * La formule composee : "2d6+1d4+3". Un SEUL d20 avec avantage devient
 * "2d20kh1" (deux d20, on garde le meilleur), avec desavantage "2d20kl1".
 */
export function composerFormule(nombres: Record<Faces, number>, bonus: number, avantage: Avantage) {
  const termes = [...FACES]
    .reverse()
    .filter((f) => nombres[f] > 0)
    .map((f) => (f === 20 && nombres[20] === 1 && avantage !== "normal" ? `2d20${avantage === "avantage" ? "kh1" : "kl1"}` : `${nombres[f]}d${f}`));
  if (!termes.length) return "";
  return termes.join("+") + (bonus ? signe(bonus) : "");
}

const NOMS_AVANTAGE: Record<Avantage, string> = { normal: "Normal", avantage: "Avantage", desavantage: "Desavantage" };

/**
 * Le lanceur de des, ouvert par le bouton "de" a cote de la discussion.
 *  - Des libres : clic sur un de = un de plus (clic droit = un de moins),
 *    un bonus, puis "Lancer". La fenetre de resolution animee s'ouvre (chez
 *    le MJ aussi) ; "Valider" annonce le resultat dans la discussion.
 *  - Tests du personnage : un bouton par caracteristique (test et sauvegarde).
 *    Le SERVEUR lit le bonus dans la fiche ; la fenetre de resolution s'ouvre.
 * Le navigateur ne lance jamais rien : il envoie seulement la demande.
 */
export function LanceurDes({ surFermer }: { surFermer: () => void }) {
  const p = useJeu((e) => jeu.personnageDesSacs(e));
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const modifiable = useJeu((e) => Boolean(p && (e.profil?.role === "mj" || jeu.mesPersonnages(e).some((m) => m.id === p.id))));
  const jetEnAttente = useJeu((e) => Boolean(e.jet && e.jet.statut === "en-attente"));
  const [nombres, setNombres] = useState(VIDE);
  const [bonus, setBonus] = useState(0);
  const [avantage, setAvantage] = useState<Avantage>("normal");
  const [raison, setRaison] = useState("");
  const [secret, setSecret] = useState(false);

  // Echap ferme le lanceur (avant que l'ecran de jeu ne ferme les fenetres).
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      surFermer();
    };
    window.addEventListener("keydown", surTouche, true);
    return () => window.removeEventListener("keydown", surTouche, true);
  }, [surFermer]);

  const formule = composerFormule(nombres, bonus, avantage);
  const ajouter = (f: Faces, n: number) => setNombres((avant) => ({ ...avant, [f]: Math.max(0, Math.min(20, avant[f] + n)) }));
  const effacer = () => {
    setNombres(VIDE);
    setBonus(0);
    setRaison("");
  };
  const lancer = async () => {
    if (!formule) return;
    // fenetre : true -> la fenetre de resolution animee s'ouvre (chez le MJ aussi).
    const r = await jeu.lancerDes(formule, raison.trim() || undefined, estMJ && secret, true);
    if (r.ok) {
      effacer();
      setAvantage("normal"); // l'avantage ne vaut que pour UN jet : on ne l'oublie pas active
    }
  };
  const tester = async (genre: "caracteristique" | "sauvegarde", carac: string) => {
    if (!p) return;
    const r = await jeu.lancerTest(p.id, genre, carac, avantage);
    if (r?.ok) setAvantage("normal");
  };
  const classe = jeu.classeDe(p);

  return (
    <section className="lanceur cadre" aria-label="Lanceur de des">
      <header className="lanceur__entete">
        <h2 className="titre-or lanceur__titre">Lanceur de des</h2>
        <button className="bouton-fermer" type="button" onClick={surFermer} aria-label="Fermer">
          x
        </button>
      </header>

      <div className="lanceur__des">
        {FACES.map((f) => (
          <button
            key={f}
            type="button"
            className={`lanceur__de${nombres[f] ? " lanceur__de--choisi" : ""}`}
            onClick={() => ajouter(f, 1)}
            onContextMenu={(e) => {
              e.preventDefault();
              ajouter(f, -1);
            }}
            {...avecInfobulle(() => (
              <>
                <div className="infobulle__titre">d{f}</div>
                <div className="infobulle__ligne--vert">Clic : un d{f} de plus.</div>
                <div className="infobulle__ligne--gris">Clic droit : un de moins.</div>
              </>
            ))}
          >
            <IconeDe faces={f} />
            {nombres[f] > 0 && <span className="lanceur__nombre">{nombres[f]}</span>}
          </button>
        ))}
      </div>

      <div className="lanceur__reglages">
        <span className="lanceur__libelle">Bonus</span>
        <button type="button" className="bouton-page" onClick={() => setBonus((b) => Math.max(-20, b - 1))} aria-label="Bonus moins un">
          -
        </button>
        <span className="lanceur__bonus">{signe(bonus)}</span>
        <button type="button" className="bouton-page" onClick={() => setBonus((b) => Math.min(30, b + 1))} aria-label="Bonus plus un">
          +
        </button>
        <div className="lanceur__avantage" role="radiogroup" aria-label="Avantage">
          {(["desavantage", "normal", "avantage"] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={avantage === a}
              className={`lanceur__option${avantage === a ? " lanceur__option--active" : ""} lanceur__option--${a}`}
              onClick={() => setAvantage(a)}
            >
              {NOMS_AVANTAGE[a]}
            </button>
          ))}
        </div>
      </div>

      <div className="lanceur__reglages">
        <input
          className="champ"
          value={raison}
          maxLength={80}
          onChange={(e) => setRaison(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lancer()}
          placeholder="Raison (facultatif) : Perception, Discretion..." />
        {estMJ && (
          <label className="lanceur__secret">
            <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} /> Secret
          </label>
        )}
      </div>

      <div className="lanceur__actions">
        <button type="button" className="bouton lanceur__lancer" disabled={!formule || jetEnAttente} onClick={lancer}>
          {formule ? `Lancer ${formule}` : "Choisis des des"}
        </button>
        <button type="button" className="bouton bouton--discret" onClick={effacer}>
          Effacer
        </button>
      </div>
      {nombres[20] > 1 && avantage !== "normal" && <p className="lanceur__astuce">L'avantage ne s'applique qu'a un seul d20.</p>}

      <h3 className="lanceur__sous-titre">{p ? `Tests de ${p.nom}` : "Tests du personnage"}</h3>
      {!p || !modifiable ? (
        <p className="lanceur__astuce">{estMJ ? "Cible un personnage (clic sur son cadre) pour lancer ses tests." : "Aucun personnage."}</p>
      ) : (
        <div className="lanceur__tests">
          {CARACTERISTIQUES.map((carac) => {
            const test = bonusDeTest(p, "caracteristique", carac, classe);
            const sauvegarde = bonusDeTest(p, "sauvegarde", carac, classe);
            const nom = (NOMS_CARACTERISTIQUES as Record<string, string>)[carac];
            return (
              <div key={carac} className="lanceur__carac">
                <span className="lanceur__nom-carac">{nom}</span>
                <button type="button" className="lanceur__test" disabled={jetEnAttente} onClick={() => tester("caracteristique", carac)}>
                  Test {signe(test.total)}
                </button>
                <button
                  type="button"
                  className={`lanceur__test${sauvegarde.maitrise ? " lanceur__test--maitrise" : ""}`}
                  disabled={jetEnAttente}
                  onClick={() => tester("sauvegarde", carac)}
                  {...avecInfobulle(() => (
                    <>
                      <div className="infobulle__titre">Sauvegarde : {nom}</div>
                      <div>
                        d20 {signe(sauvegarde.modificateur)} ({nom}){sauvegarde.maitrise ? ` ${signe(sauvegarde.maitrise)} (Maitrise)` : ""}
                      </div>
                      {sauvegarde.maitrise > 0 && <div className="infobulle__ligne--or">Sauvegarde maitrisee par la classe.</div>}
                    </>
                  ))}
                >
                  Sauv. {signe(sauvegarde.total)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Le petit bouton "d20" a cote de la saisie de la discussion. */
export function BoutonDes({ ouvert, surClic }: { ouvert: boolean; surClic: () => void }) {
  return (
    <button
      type="button"
      className={`bouton-des${ouvert ? " bouton-des--ouvert" : ""}`}
      onClick={surClic}
      aria-label="Lanceur de des"
      aria-expanded={ouvert}
      {...avecInfobulle(() => (
        <>
          <div className="infobulle__titre">Lanceur de des</div>
          <div className="infobulle__ligne--gris">Des libres, tests et sauvegardes du personnage.</div>
        </>
      ))}
    >
      <IconeDe faces={20} />
    </button>
  );
}
