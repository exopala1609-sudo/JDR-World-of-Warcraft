import { useEffect, useState } from "react";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone } from "@/core/medias";
import type { Jet, LigneJet } from "@/core/types";
import { FORMES, formeProche } from "@/ui/formesDes";

const DUREE_ROULEMENT_MS = 1100; // le de "roule" avant d'afficher son resultat

/**
 * Le grand de anime, dessine en SVG. Le d20 : un hexagone (un icosaedre vu
 * de face), son triangle central et ses aretes. Les autres des : leur
 * silhouette (d6 carre, d8 losange...). Le chiffre est au centre.
 */
export function GrosDe({ faces, valeur, etat }: { faces: number; valeur: number | string; etat: "roule" | "critique" | "echec" | "normal" }) {
  const forme = formeProche(faces);
  return (
    <div className={`d20 d20--${etat}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <polygon className="d20__corps" points={FORMES[forme]} />
        {forme === 20 && (
          <>
            <polygon className="d20__face" points="50,21 76,66 24,66" />
            <path className="d20__aretes" d="M50,3 L50,21 M91,26.5 L76,66 M9,26.5 L24,66 M50,97 L76,66 M50,97 L24,66 M91,73.5 L76,66 M9,73.5 L24,66 M9,26.5 L50,21 M91,26.5 L50,21" />
          </>
        )}
      </svg>
      <span className={`d20__valeur${forme === 4 ? " d20__valeur--bas" : ""}`}>{valeur}</span>
    </div>
  );
}

/** Une "puce" de l'equation : un titre (De, Force...) au-dessus de sa valeur. */
function Puce({ titre, valeur, genre }: { titre: string; valeur: string; genre: "de" | "ecarte" | "modificateur" | "total" }) {
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
  const combat = /^(Degats|Soins)/.test(ligne.libelle); // chiffres en Skurri
  return (
    <div className={`equation${combat ? " equation--combat" : ""}${ligne.critique ? " equation--critique" : ""}${ligne.echec ? " equation--echec" : ""}`}>
      <div className="equation__libelle">{ligne.libelle}</div>
      <div className="equation__termes">
        {ligne.d20 !== null ? (
          <>
            <Puce titre={ligne.d20Ecarte !== null ? "De garde" : "De"} valeur={String(ligne.d20)} genre="de" />
            {/* Avantage / desavantage : l'autre d20, barre */}
            {ligne.d20Ecarte !== null && <Puce titre="Ecarte" valeur={String(ligne.d20Ecarte)} genre="ecarte" />}
          </>
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

/** Les boutons du MJ : retirer les degats (ou la moitie : sauvegarde reussie), ou soigner, a la cible. */
function AppliquerAuMJ({ jet }: { jet: Jet }) {
  const [fait, setFait] = useState<string | null>(null);
  const cible = useJeu((e) => (jet.cible ? e.personnages[jet.cible.idPersonnage] : undefined));
  if (!jet.cible || !cible || jet.cible.touche === false) return null;
  const degats = jet.lignes.find((l) => l.libelle.startsWith("Degats"));
  const soins = jet.lignes.find((l) => l.libelle === "Soins");
  const critique = jet.lignes.some((l) => l.critique);
  const appliquer = (type: "degats" | "soins", montant: number, libelle: string) => {
    jeu.demander(EVENEMENTS.PERSONNAGE_MODIFIER_PV, { idPersonnage: cible.id, type, montant, critique: type === "degats" && critique, sansTexte: true });
    setFait(libelle);
  };
  if (!degats && !soins) return null;
  return (
    <div className="resolution__mj">
      <span className="resolution__mj-titre">
        MJ - {cible.nom} ({cible.pointsDeVie.actuels} / {cible.pointsDeVie.max} PV)
      </span>
      {fait ? (
        <span className="resolution__mj-fait">{fait}</span>
      ) : (
        <>
          {degats && degats.total > 0 && (
            <>
              <button type="button" className="bouton bouton--danger" onClick={() => appliquer("degats", degats.total, `-${degats.total} PV applique`)}>
                Retirer {degats.total} PV
              </button>
              <button type="button" className="bouton bouton--discret" onClick={() => appliquer("degats", Math.floor(degats.total / 2), `-${Math.floor(degats.total / 2)} PV applique`)}>
                Moitie ({Math.floor(degats.total / 2)})
              </button>
            </>
          )}
          {soins && soins.total > 0 && (
            <button type="button" className="bouton" onClick={() => appliquer("soins", soins.total, `+${soins.total} PV applique`)}>
              Soigner {soins.total} PV
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Resolution({ jet }: { jet: Jet }) {
  const profil = useJeu((e) => e.profil);
  const estMJ = profil?.role === "mj";
  const estLanceur = jet.par.toLocaleLowerCase("fr") === profil?.pseudo.toLocaleLowerCase("fr");
  const [roule, setRoule] = useState(jet.statut !== "valide");
  const [defile, setDefile] = useState(1); // le chiffre qui defile pendant que le de roule
  // Le grand de : le d20 de la premiere ligne qui en a un, sinon les des de la
  // premiere ligne (degats d'un sort automatique, des libres "2d6").
  const premierD20 = jet.lignes.find((l) => l.d20 !== null) ?? null;
  const ligneDes = premierD20 ? null : (jet.lignes.find((l) => l.des) ?? null);
  const grosDe = premierD20
    ? { faces: 20, valeur: premierD20.d20! }
    : ligneDes?.des
      ? { faces: ligneDes.des.faces || 6, valeur: ligneDes.des.total }
      : null;
  const facesDefile = grosDe?.faces ?? 20;

  useEffect(() => {
    if (!roule) return;
    const defilement = setInterval(() => setDefile(1 + Math.floor(Math.random() * facesDefile)), 70);
    const fin = setTimeout(() => setRoule(false), grosDe ? DUREE_ROULEMENT_MS : 300);
    return () => {
      clearInterval(defilement);
      clearTimeout(fin);
    };
  }, [roule, facesDefile, grosDe !== null]);

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
            {jet.action.icone ? <img src={urlIcone(jet.action.icone)} alt="" /> : <span className="resolution__glyphe">d20</span>}
          </span>
          <div>
            <h2 className={`resolution__nom${jet.action.rarete ? " texte-rarete" : ""}`} data-rarete={jet.action.rarete ?? undefined}>
              {jet.action.nom}
            </h2>
            <p className="resolution__detail">{jet.action.detail}</p>
            <p className="resolution__lanceur">
              {jet.personnage}
              {!estLanceur && jet.personnage !== jet.par && ` - joueur : ${jet.par}`}
            </p>
          </div>
        </header>

        {grosDe && <GrosDe faces={grosDe.faces} valeur={roule ? defile : grosDe.valeur} etat={etatDe} />}
        {jet.secret && <p className="resolution__secret">Jet secret : seul le MJ verra le resultat.</p>}

        <div className={`resolution__lignes${roule ? "" : " resolution__lignes--revelees"}`}>
          {jet.lignes.map((ligne) => (
            <Equation key={ligne.libelle} ligne={ligne} />
          ))}
          {jet.lignes.length === 0 && <p className="resolution__note">Le sort est lance.</p>}
          {jet.note && <p className="resolution__note">{jet.note}</p>}
          {jet.cout && <p className="resolution__cout">Cout : {jet.cout} (deja depense)</p>}
        </div>

        {/* MJ : appliquer le resultat a la cible. Jamais automatique (regle d'or) :
            le jeu calcule, le MJ decide (resistance, sauvegarde reussie...). */}
        {estMJ && !roule && <AppliquerAuMJ jet={jet} />}

        <footer className="resolution__pied">
          {valide ? (
            <>
              <p className="resolution__annonce">Resultat annonce a la table.</p>
              {estMJ && jet.cible && (
                <button type="button" className="bouton bouton--discret" onClick={() => jeu.modifier({ jet: null })}>
                  Fermer
                </button>
              )}
            </>
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
