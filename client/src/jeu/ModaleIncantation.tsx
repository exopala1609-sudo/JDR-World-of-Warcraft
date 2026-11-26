import { useEffect, useState } from "react";
import { attaquesEquipees, referenceObjet } from "@partage/equipement.js";
import { emplacementsDuPersonnage, formuleAuNiveau } from "@partage/magie.js";
import { jeu, useJeu, type Avantage } from "@/core/jeu";
import { signe } from "@/core/journal";
import { iconeObjet } from "@/core/medias";
import type { Objet } from "@/core/types";
import { Gemmes } from "@/jeu/ActionsSorts";
import { rangDuSort } from "@/jeu/Grimoire";

const MODES: [Avantage, string][] = [
  ["desavantage", "Desavantage"],
  ["normal", "Normal"],
  ["avantage", "Avantage"],
];

/**
 * La modale d'incantation : on CONFIRME l'action avant que les des roulent.
 *  - Sort : le niveau de l'emplacement (le sien, ou plus haut pour le
 *    renforcer). Les emplacements s'affichent en gemmes : un clic sur une
 *    rangee choisit ce niveau. "Lancer" eteint une gemme (le serveur).
 *  - Arme : Avantage, Normal ou Desavantage (deux d20, on garde le meilleur /
 *    le pire).
 * La cible (le pion ou le cadre clique) est rappelee ; elle n'est pas
 * obligatoire : sans elle, le resultat va seulement dans la discussion.
 * Entree = confirmer, Echap = annuler.
 */
export function ModaleIncantation() {
  const incantation = useJeu((e) => e.incantation);
  const p = useJeu((e) => (e.incantation ? e.personnages[e.incantation.idPersonnage] : undefined));
  const nomCible = useJeu((e) => (e.cible ? (e.personnages[e.cible]?.nom ?? e.scene?.pions.find((x) => x.idPersonnage === e.cible)?.nom ?? null) : null));
  const [niveau, setNiveau] = useState<number | null>(null);
  const [mode, setMode] = useState<Avantage>("normal");
  const [envoi, setEnvoi] = useState(false);
  const fermer = () => jeu.modifier({ incantation: null });

  // Nouvelle action : on repart du niveau du sort, en "Normal".
  useEffect(() => {
    setNiveau(null);
    setMode("normal");
  }, [incantation?.reference, incantation?.idPersonnage]);

  const sort = p && incantation?.genre === "sort" ? p.grimoire.find((s) => s.source === incantation.reference || s.id === incantation.reference) : undefined;
  const arme =
    p && incantation?.genre === "arme"
      ? attaquesEquipees(p).find((a) => {
          const objet = p.equipement[a.emplacement as keyof typeof p.equipement] as Objet | undefined;
          return objet && referenceObjet(objet) === incantation.reference;
        })
      : undefined;
  const objetArme = p && arme ? (p.equipement[arme.emplacement as keyof typeof p.equipement] as Objet) : undefined;

  const classe = p ? jeu.classeDe(p) : null;
  const emplacements = p && sort && sort.niveau > 0 ? emplacementsDuPersonnage(p, classe).filter((e) => e.niveau >= sort.niveau) : [];
  // Le niveau choisi : sinon le plus bas qui a encore une gemme allumee.
  const niveauChoisi = sort ? (niveau ?? emplacements.find((e) => e.actuel > 0)?.niveau ?? sort.niveau) : 0;
  const emplacementChoisi = emplacements.find((e) => e.niveau === niveauChoisi);
  const sansEmplacement = Boolean(sort && sort.niveau > 0 && emplacements.length > 0 && !(emplacementChoisi && emplacementChoisi.actuel > 0));

  const confirmer = async () => {
    if (!p || !incantation || envoi || sansEmplacement) return;
    setEnvoi(true);
    const r =
      incantation.genre === "sort"
        ? await jeu.lancerSort(p.id, incantation.reference, sort && sort.niveau > 0 && emplacements.length ? { niveau: niveauChoisi } : {})
        : await jeu.utiliser(p.id, incantation.reference, { avantage: mode });
    setEnvoi(false);
    if (r.ok) fermer();
  };

  // Entree : confirmer ; Echap : annuler (sans fermer les fenetres derriere).
  useEffect(() => {
    if (!incantation) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fermer();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        confirmer();
      }
    };
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
  });

  if (!incantation || !p) return null;
  if (!sort && !arme) {
    // L'action n'existe plus (sort oublie, arme rangee) : on referme.
    queueMicrotask(fermer);
    return null;
  }

  const enPlus = sort && sort.niveau > 0 ? niveauChoisi - sort.niveau : 0;
  return (
    <div className="modale modale--voile" onPointerDown={(e) => e.target === e.currentTarget && fermer()}>
      <section className="incantation cadre" role="dialog" aria-label={sort ? `Lancer ${sort.nom}` : `Attaquer avec ${objetArme?.nom}`}>
        <header className="incantation__entete">
          <span className="case incantation__icone" data-rarete={objetArme?.rarete}>
            <img src={iconeObjet(sort ?? objetArme!)} alt="" />
          </span>
          <div>
            <h2 className="titre-or incantation__titre">{sort ? sort.nom : objetArme!.nom}</h2>
            <p className="incantation__sous-titre">{sort ? rangDuSort(sort) : `${signe(arme!.bonus)} au toucher - ${arme!.degats} ${arme!.typeDegats}`}</p>
          </div>
        </header>

        <p className={`incantation__cible${nomCible ? "" : " incantation__cible--aucune"}`}>
          {nomCible ? `Cible : ${nomCible}` : "Aucune cible : le resultat ira seulement dans la discussion (clique un pion pour cibler)."}
        </p>

        {sort && sort.niveau === 0 && <p className="incantation__info">Sort mineur : aucun emplacement depense.</p>}
        {sort && sort.niveau > 0 && emplacements.length === 0 && <p className="incantation__info">{p.nom} n'utilise pas d'emplacements de sorts.</p>}
        {sort && emplacements.length > 0 && (
          <div className="incantation__niveaux" role="radiogroup" aria-label="Niveau de l'emplacement">
            {emplacements.map((e) => (
              <button
                key={e.niveau}
                type="button"
                role="radio"
                aria-checked={e.niveau === niveauChoisi}
                className={`incantation__niveau${e.niveau === niveauChoisi ? " incantation__niveau--choisi" : ""}`}
                disabled={e.actuel === 0}
                onClick={() => setNiveau(e.niveau)}
              >
                <span className="incantation__niveau-nom">Niveau {e.niveau}</span>
                <Gemmes actuel={e.actuel} max={e.max} choisi={e.niveau === niveauChoisi} />
                <span className="incantation__niveau-reste">{e.actuel === 0 ? "epuise" : `${e.actuel} / ${e.max}`}</span>
              </button>
            ))}
          </div>
        )}
        {sort && enPlus > 0 && (sort.degats || sort.soins) && (
          <p className="incantation__info incantation__info--or">
            Renforce (+{enPlus}) :{" "}
            {sort.degats ? `${formuleAuNiveau(sort.degats.formule, sort.parNiveauSuperieur, enPlus)} ${sort.degats.type}` : `soins ${formuleAuNiveau(sort.soins!, sort.parNiveauSuperieur, enPlus)}`}
            {!sort.parNiveauSuperieur && " (ce sort ne gagne rien a etre renforce)"}
          </p>
        )}
        {sort?.concentration && <p className="incantation__info">Concentration : l'aura s'affichera sous ton portrait (elle remplace une autre concentration).</p>}
        {sort?.cout && <p className="incantation__info">Cout : {sort.cout.quantite} {p.ressources.find((r) => r.cle === sort.cout!.ressource)?.nom ?? sort.cout.ressource}</p>}

        {arme && (
          <div className="incantation__modes" role="radiogroup" aria-label="Avantage">
            {MODES.map(([cle, nom]) => (
              <button key={cle} type="button" role="radio" aria-checked={mode === cle} className={`onglet${mode === cle ? " onglet--actif" : ""} incantation__mode--${cle}`} onClick={() => setMode(cle)}>
                {nom}
              </button>
            ))}
          </div>
        )}

        <div className="incantation__actions">
          <button type="button" className="bouton" disabled={envoi || sansEmplacement} onClick={confirmer}>
            {sort ? (sansEmplacement ? "Plus d'emplacement" : "Lancer") : "Attaquer"}
          </button>
          <button type="button" className="bouton bouton--discret" onClick={fermer}>
            Annuler
          </button>
        </div>
      </section>
    </div>
  );
}
