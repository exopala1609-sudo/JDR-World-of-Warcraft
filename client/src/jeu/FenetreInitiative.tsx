import { useState } from "react";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import type { Personnage } from "@/core/types";
import { Barre } from "@/ui/Barre";
import { Fenetre } from "@/ui/Fenetre";

/** La valeur d'initiative, modifiable d'un clic par le MJ. */
function Initiative({ idParticipant, valeur, modifiable }: { idParticipant: string; valeur: number | null; modifiable: boolean }) {
  const [edition, setEdition] = useState<string | null>(null);
  if (valeur === null) return <span className="raid__init">?</span>;
  if (!modifiable) return <span className="raid__init">{valeur}</span>;
  if (edition === null) {
    return (
      <button type="button" className="raid__init raid__init--modifiable" title="Changer l'initiative" onClick={() => setEdition(String(valeur))}>
        {valeur}
      </button>
    );
  }
  const valider = () => {
    const n = Number(edition);
    if (Number.isInteger(n) && n !== valeur) jeu.demander(EVENEMENTS.COMBAT_FIXER_INITIATIVE, { idParticipant, valeur: n });
    setEdition(null);
  };
  return (
    <input
      className="champ raid__init-champ"
      type="number"
      value={edition}
      autoFocus
      onChange={(e) => setEdition(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => {
        if (e.key === "Enter") valider();
        if (e.key === "Escape") setEdition(null);
      }}
    />
  );
}

/** Une case "cadre de raid" : nom, barre de vie (si on la connait), initiative. */
function CaseRaid({ nom, p, actif, masque, children }: { nom: string; p: Personnage | null; actif: boolean; masque?: boolean; children?: React.ReactNode }) {
  const pv = p?.pointsDeVie;
  const classes = ["raid__case", actif && "raid__case--actif", masque && "raid__case--masque", pv && pv.actuels === 0 && "raid__case--terre"];
  return (
    <div className={classes.filter(Boolean).join(" ")} onClick={() => p && jeu.modifier({ selection: p.id })}>
      <div className="raid__infos">
        <span className="raid__nom">{nom}</span>
        {pv ? <Barre classe="barre--vie raid__vie" actuel={pv.actuels} max={pv.max} texte={`${pv.actuels} / ${pv.max}`} /> : <div className="raid__vie raid__vie--inconnue" />}
      </div>
      {children}
    </div>
  );
}

/**
 * Le suivi d'initiative, facon cadres de raid de WoW. Le MJ y prepare et
 * mene le combat : choisir les combattants parmi les pions de la carte,
 * lancer l'initiative, reordonner, passer les tours. Les joueurs voient la
 * meme fenetre en lecture seule (et "Fin de mon tour" quand c'est le leur).
 * Le combattant actif pulse aussi sur la carte, chez tout le monde.
 */
export function FenetreInitiative({ position }: { position: { x: number; y: number } }) {
  const combat = useJeu((e) => e.combat);
  const personnages = useJeu((e) => e.personnages);
  const pions = useJeu((e) => e.scene?.pions ?? []);
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const mesIds = useJeu((e) => jeu.mesPersonnages(e).map((p) => p.id).join(","));
  const [exclus, setExclus] = useState<Set<string>>(new Set()); // pions decoches avant le combat
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, initiative: false } }));

  const basculer = (id: string) =>
    setExclus((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });

  // --- Avant le combat : les pions presents sur la carte ---------------------------
  if (!combat) {
    const candidats = pions.filter((p) => personnages[p.idPersonnage]);
    const choisis = candidats.filter((p) => !exclus.has(p.idPersonnage)).map((p) => p.idPersonnage);
    return (
      <Fenetre titre="Initiative" classe="raid" positionInitiale={position} surFermer={fermer}>
        <p className="raid__statut">Pas de combat en cours.</p>
        {estMJ ? (
          <>
            <p className="raid__aide">Combattants (pions sur la carte) :</p>
            <div className="raid__grille">
              {candidats.length === 0 && <p className="raid__aide">Aucun pion sur la carte.</p>}
              {candidats.map((pion) => (
                <label key={pion.id} className={`raid__case raid__case--choix${exclus.has(pion.idPersonnage) ? " raid__case--exclu" : ""}`}>
                  <input type="checkbox" checked={!exclus.has(pion.idPersonnage)} onChange={() => basculer(pion.idPersonnage)} />
                  <span className="raid__nom">
                    {pion.nom}
                    {pion.cache ? " (cache)" : ""}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="bouton raid__lancer"
              disabled={choisis.length === 0}
              onClick={() => jeu.demander(EVENEMENTS.COMBAT_DEMARRER, { idsPersonnages: choisis })}
            >
              Lancer l'initiative ({choisis.length})
            </button>
          </>
        ) : (
          <p className="raid__aide">Le MJ lancera l'initiative au debut du combat.</p>
        )}
      </Fenetre>
    );
  }

  // --- Pendant le combat ------------------------------------------------------------
  const actif = combat.participants[combat.indexActif];
  const absents = estMJ ? pions.filter((p) => personnages[p.idPersonnage] && !combat.participants.some((c) => c.idPersonnage === p.idPersonnage)) : [];
  const monTour = Boolean(actif?.idPersonnage && mesIds.split(",").includes(actif.idPersonnage));
  return (
    <Fenetre titre={`Initiative - Round ${combat.round}`} classe="raid" positionInitiale={position} surFermer={fermer}>
      <p className="raid__statut">Au tour de : {actif?.nom}</p>
      <div className="raid__liste">
        {combat.participants.map((c, i) => (
          <div key={c.id} className="raid__rang">
            <span className="raid__numero">{i + 1}</span>
            <CaseRaid nom={c.nom} p={c.idPersonnage ? (personnages[c.idPersonnage] ?? null) : null} actif={i === combat.indexActif} masque={c.masque}>
              <Initiative idParticipant={c.id} valeur={c.initiative} modifiable={estMJ} />
            </CaseRaid>
            {estMJ && (
              <span className="raid__outils">
                <button type="button" className="raid__outil" title="Monter" disabled={i === 0} onClick={() => jeu.demander(EVENEMENTS.COMBAT_DEPLACER, { idParticipant: c.id, sens: -1 })}>
                  ▲
                </button>
                <button
                  type="button"
                  className="raid__outil"
                  title="Descendre"
                  disabled={i === combat.participants.length - 1}
                  onClick={() => jeu.demander(EVENEMENTS.COMBAT_DEPLACER, { idParticipant: c.id, sens: 1 })}
                >
                  ▼
                </button>
                <button type="button" className="raid__outil raid__outil--retirer" title="Retirer du combat" onClick={() => jeu.demander(EVENEMENTS.COMBAT_RETIRER, { idParticipant: c.id })}>
                  ✕
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="raid__actions">
        {estMJ && (
          <button type="button" className="bouton bouton--discret" onClick={() => jeu.demander(EVENEMENTS.COMBAT_TOUR_PRECEDENT)}>
            Tour precedent
          </button>
        )}
        {(estMJ || monTour) && (
          <button type="button" className="bouton raid__suivant" onClick={() => actif && jeu.demander(EVENEMENTS.COMBAT_TOUR_SUIVANT, { idActif: actif.id })}>
            {estMJ ? "Tour suivant" : "Fin de mon tour"}
          </button>
        )}
        {estMJ && (
          <button type="button" className="bouton bouton--discret" onClick={() => jeu.demander(EVENEMENTS.COMBAT_TERMINER)}>
            Terminer
          </button>
        )}
      </div>
      {estMJ && absents.length > 0 && (
        <div className="raid__ajout">
          <span>Ajouter :</span>
          {absents.map((p) => (
            <button key={p.id} type="button" className="raid__puce" onClick={() => jeu.demander(EVENEMENTS.COMBAT_AJOUTER, { idPersonnage: p.idPersonnage })}>
              + {p.nom}
            </button>
          ))}
        </div>
      )}
    </Fenetre>
  );
}
