import { useState } from "react";
import { palierRenommee } from "@partage/creation.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import type { PalierRenommee, Personnage } from "@/core/types";

type Resultat = { ok: boolean; erreur?: string };
const signaler = (r: Resultat) => !r.ok && jeu.journaliser(r.erreur ?? "Refus du serveur.", "erreur");

/**
 * La reputation d'un personnage, facon WoW : une barre par faction, coloree
 * selon le palier (Hostile, Neutre, Amical, Honore, Revere, Exalte). Un clic
 * deplie les avantages obtenus (et ceux du palier suivant, en grise).
 * Le MJ ajoute une faction, monte ou baisse un score, ou le retire.
 */
export function Reputation({ p }: { p: Personnage }) {
  const referentiel = useJeu((e) => e.referentiel);
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const [ajout, setAjout] = useState("");
  if (!referentiel) return null;
  const paliers = referentiel.creation.paliersRenommee;
  const renommees = p.renommees ?? [];
  const changer = async (faction: string, demande: { variation?: number; score?: number | null }) =>
    signaler(await jeu.demander(EVENEMENTS.PERSONNAGE_RENOMMEE, { idPersonnage: p.id, faction, ...demande }));
  const absentes = referentiel.renommees.filter((f) => !renommees.some((r) => r.faction === f.id));

  return (
    <details open>
      <summary>Reputation</summary>
      {renommees.length === 0 && <p className="reputation__vide">Aucune renommee pour l'instant.</p>}
      {renommees.map((r) => {
        const faction = referentiel.renommees.find((f) => f.id === r.faction);
        const { palier, suivant, progression } = palierRenommee(r.score, paliers) as { palier: PalierRenommee; suivant: PalierRenommee | null; progression: number };
        const atteint = (id: string) => (paliers.find((x) => x.id === id)?.min ?? Infinity) <= r.score;
        const avantages = (faction?.avantages ?? []).filter((a) => atteint(a.palier) || a.palier === suivant?.id);
        return (
          <div key={r.faction} className="reputation">
            <details>
              <summary className="reputation__ligne" title="Cliquer pour voir les avantages">
                <span className="reputation__nom">{faction?.nom ?? r.faction}</span>
                <span className="reputation__barre" style={{ ["--couleur-palier" as string]: palier.couleur }}>
                  <span className="reputation__remplissage" style={{ width: `${Math.round(progression * 100)}%` }} />
                  <span className="reputation__texte">
                    {palier.nom} {r.score}
                    {suivant ? ` / ${suivant.min}` : ""}
                  </span>
                </span>
              </summary>
              {avantages.length === 0 && <p className="reputation__vide">Pas d'avantage decrit pour cette faction.</p>}
              {avantages.map((a, i) => (
                <p key={i} className={`reputation__avantage${atteint(a.palier) ? "" : " reputation__avantage--futur"}`}>
                  <b>
                    {paliers.find((x) => x.id === a.palier)?.nom}
                    {a.nom !== "Tous" ? ` - ${a.nom}` : ""} :
                  </b>{" "}
                  {a.description}
                </p>
              ))}
            </details>
            {estMJ && (
              <span className="reputation__mj">
                <button type="button" onClick={() => changer(r.faction, { variation: -1 })} aria-label="Baisser">
                  −
                </button>
                <button type="button" onClick={() => changer(r.faction, { variation: 1 })} aria-label="Monter">
                  +
                </button>
                <button type="button" onClick={() => changer(r.faction, { score: null })} aria-label="Retirer" title="Retirer cette faction">
                  ×
                </button>
              </span>
            )}
          </div>
        );
      })}
      {estMJ && absentes.length > 0 && (
        <div className="reputation__ajout">
          <select className="champ" value={ajout} onChange={(e) => setAjout(e.target.value)}>
            <option value="">Ajouter une faction...</option>
            {absentes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
          <button type="button" className="bouton" disabled={!ajout} onClick={() => changer(ajout, { score: 0 }).then(() => setAjout(""))}>
            Ajouter
          </button>
        </div>
      )}
    </details>
  );
}

/** Les langues connues. Le MJ en ajoute (y compris les rares) ou en retire. */
export function Langues({ p }: { p: Personnage }) {
  const referentiel = useJeu((e) => e.referentiel);
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const [ajout, setAjout] = useState("");
  if (!referentiel) return null;
  const langues = p.langues ?? [];
  const changer = async (langue: string, connue: boolean) =>
    signaler(await jeu.demander(EVENEMENTS.PERSONNAGE_LANGUE, { idPersonnage: p.id, langue, connue }));
  const nom = (id: string) => referentiel.langues.find((l) => l.id === id)?.nom ?? id;
  const absentes = referentiel.langues.filter((l) => !langues.includes(l.id));

  return (
    <details open>
      <summary>Langues</summary>
      {langues.length === 0 && <p className="reputation__vide">Aucune langue notee.</p>}
      <div className="langues">
        {langues.map((id) => (
          <span key={id} className="langues__langue">
            {nom(id)}
            {estMJ && (
              <button type="button" onClick={() => changer(id, false)} aria-label={`Retirer ${nom(id)}`}>
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {estMJ && absentes.length > 0 && (
        <div className="reputation__ajout">
          <select className="champ" value={ajout} onChange={(e) => setAjout(e.target.value)}>
            <option value="">Ajouter une langue...</option>
            {absentes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
                {l.rare ? " (rare)" : ""}
              </option>
            ))}
          </select>
          <button type="button" className="bouton" disabled={!ajout} onClick={() => changer(ajout, true).then(() => setAjout(""))}>
            Ajouter
          </button>
        </div>
      )}
    </details>
  );
}
