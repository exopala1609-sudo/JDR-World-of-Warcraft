import { useEffect, useState } from "react";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone } from "@/core/medias";
import type { Jet, LigneJet } from "@/core/types";

const DUREE_ROULEMENT_MS = 1100; // le d20 "roule" avant d'afficher son resultat

/**
 * Le d20 dessine en SVG : un hexagone (le contour d'un icosaedre vu de face),
 * son triangle central et ses aretes. Le chiffre est au centre.
 */
function D20({ valeur, etat }: { valeur: number | string; etat: "roule" | "critique" | "echec" | "normal" }) {
  return (
    <div className={`d20 d20--${etat}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <polygon className="d20__corps" points="50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5" />
        <polygon className="d20__face" points="50,21 76,66 24,66" />
        <path className="d20__aretes" d="M50,3 L50,21 M91,26.5 L76,66 M9,26.5 L24,66 M50,97 L76,66 M50,97 L24,66 M91,73.5 L76,66 M9,73.5 L24,66 M9,26.5 L50,21 M91,26.5 L50,21" />
      </svg>
      <span className="d20__valeur">{valeur}</span>
    </div>
  );
}

/** Une "puce" de l'equation : un titre (De, Force...) au-dessus de sa valeur. */
function Puce({ titre, valeur, genre }: { titre: string; valeur: string; genre: "de" | "modificateur" | "total" }) {
  return (
    <span className={`puce puce--${genre}`}>
      <span className="puce__valeur">{valeur}</span>
      <span className="puce__titre">{titre}</span>
    </span>
  );
}

/** Une ligne : De (14) + Force (+3) + Maitrise (+2) = 19 */
function Equation({ ligne }: { ligne: LigneJet }) {
  const termes = ligne.modificateurs.filter((m) => m.valeur !== 0);
  return (
    <div className={`equation${ligne.critique ? " equation--critique" : ""}${ligne.echec ? " equation--echec" : ""}`}>
      <div className="equation__libelle">{ligne.libelle}</div>
      <div className="equation__termes">
        {ligne.d20 !== null ? (
          <Puce titre="De" valeur={String(ligne.d20)} genre="de" />
        ) : (
          ligne.des && <Puce titre={`Des (${ligne.des.formule})`} valeur={ligne.des.jets.join(" + ") || String(ligne.des.total)} genre="de" />
        )}
        {termes.map((m) => (
          <span key={m.nom} className="equation__groupe">
            <span className="equation__operateur">{m.valeur < 0 ? "-" : "+"}</span>
            <Puce titre={m.nom} valeur={String(Math.abs(m.valeur))} genre="modificateur" />
          </span>
        ))}
        <span className="equation__operateur">=</span>
        <Puce titre={ligne.critique ? "Critique !" : ligne.echec ? "Echec" : "Total"} valeur={String(ligne.total)} genre="total" />
      </div>
    </div>
  );
}

function Resolution({ jet }: { jet: Jet }) {
  const profil = useJeu((e) => e.profil);
  const estMJ = profil?.role === "mj";
  const estLanceur = jet.par.toLocaleLowerCase("fr") === profil?.pseudo.toLocaleLowerCase("fr");
  const [roule, setRoule] = useState(jet.statut !== "valide");
  const [defile, setDefile] = useState(1); // le chiffre qui defile pendant que le de roule
  const premierD20 = jet.lignes.find((l) => l.d20 !== null) ?? null;

  useEffect(() => {
    if (!roule) return;
    const defilement = setInterval(() => setDefile(1 + Math.floor(Math.random() * 20)), 70);
    const fin = setTimeout(() => setRoule(false), premierD20 ? DUREE_ROULEMENT_MS : 300);
    return () => {
      clearInterval(defilement);
      clearTimeout(fin);
    };
  }, [roule, premierD20]);

  const valide = jet.statut === "valide";
  const peutValider = !valide && !roule && (estLanceur || estMJ);

  // Entree (ou Espace) = Valider. En "capture" : la touche n'ouvre pas la discussion.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (!peutValider || (e.key !== "Enter" && e.key !== " ")) return;
      if ((e.target as HTMLElement).closest?.("input, textarea, select")) return; // le MJ ecrit une quete
      e.preventDefault();
      e.stopPropagation();
      jeu.validerJet();
    };
    window.addEventListener("keydown", surTouche, true);
    return () => window.removeEventListener("keydown", surTouche, true);
  }, [peutValider]);

  const etatDe = roule ? "roule" : premierD20?.critique ? "critique" : premierD20?.echec ? "echec" : "normal";
  return (
    // Le lanceur : un voile assombrit l'ecran et bloque la carte jusqu'a "Valider".
    // Le MJ : pas de voile, il peut continuer a jouer pendant que le joueur valide.
    <div className={`modale${estLanceur ? " modale--voile" : ""}`}>
      <section className="resolution cadre" role="dialog" aria-modal={estLanceur} aria-label={`Resolution : ${jet.action.nom}`}>
        <header className="resolution__entete">
          <span className="case resolution__icone" data-rarete={jet.action.rarete ?? undefined}>
            {jet.action.icone && <img src={urlIcone(jet.action.icone)} alt="" />}
          </span>
          <div>
            <h2 className={`resolution__nom${jet.action.rarete ? " texte-rarete" : ""}`} data-rarete={jet.action.rarete ?? undefined}>
              {jet.action.nom}
            </h2>
            <p className="resolution__detail">{jet.action.detail}</p>
            <p className="resolution__lanceur">
              {jet.personnage}
              {!estLanceur && ` - joueur : ${jet.par}`}
            </p>
          </div>
        </header>

        {premierD20 && <D20 valeur={roule ? defile : premierD20.d20!} etat={etatDe} />}

        <div className={`resolution__lignes${roule ? "" : " resolution__lignes--revelees"}`}>
          {jet.lignes.map((ligne) => (
            <Equation key={ligne.libelle} ligne={ligne} />
          ))}
          {jet.lignes.length === 0 && <p className="resolution__note">Le sort est lance.</p>}
          {jet.note && <p className="resolution__note">{jet.note}</p>}
          {jet.cout && <p className="resolution__cout">Cout : {jet.cout} (deja depense)</p>}
        </div>

        <footer className="resolution__pied">
          {valide ? (
            <p className="resolution__annonce">Resultat annonce a la table.</p>
          ) : estLanceur ? (
            <button type="button" className="bouton resolution__valider" disabled={roule} onClick={() => jeu.validerJet()}>
              Valider
            </button>
          ) : estMJ ? (
            <>
              <button type="button" className="bouton" disabled={roule} onClick={() => jeu.validerJet()}>
                Valider pour {jet.par}
              </button>
              <button type="button" className="bouton bouton--discret" onClick={() => jeu.modifier({ jet: null })}>
                Masquer
              </button>
            </>
          ) : null}
          {!valide && !estLanceur && estMJ && <p className="resolution__attente">En attente de la validation de {jet.par}...</p>}
        </footer>
      </section>
    </div>
  );
}

/**
 * Fenetre de resolution facon Baldur's Gate 3, au centre de l'ecran du
 * joueur ET du MJ. Les chiffres viennent du serveur : l'interface ne fait que
 * les montrer (et ne peut pas les changer).
 */
export function ModaleResolution() {
  const jet = useJeu((e) => e.jet);
  if (!jet) return null;
  return <Resolution key={jet.id} jet={jet} />;
}

/** "Nouvelle quete : ..." en lettres d'or au centre de l'ecran (quelques secondes). */
export function Annonce() {
  const annonce = useJeu((e) => e.annonce);
  if (!annonce) return null;
  return (
    <div key={annonce.id} className="annonce" role="status">
      <div className="annonce__titre">{annonce.titre}</div>
      <div className="annonce__texte">{annonce.texte}</div>
    </div>
  );
}
