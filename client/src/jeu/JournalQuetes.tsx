import { useState, type FormEvent } from "react";
import { jeu, useJeu } from "@/core/jeu";
import type { Quete } from "@/core/types";
import { Fenetre } from "@/ui/Fenetre";

const STATUTS: Record<Quete["statut"], string> = { "en-cours": "", terminee: "Terminee", echouee: "Echec" };

/** (MJ) Le formulaire "Nouvelle quete", ecrit sur le parchemin. */
function NouvelleQuete({ surFin }: { surFin: (idQuete?: string) => void }) {
  const [titre, setTitre] = useState("");
  const [objectif, setObjectif] = useState("");
  const [description, setDescription] = useState("");
  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const r = await jeu.donnerQuete(titre.trim(), objectif.trim(), description.trim() || undefined);
    if (r.ok) surFin((r.quete as Quete).id);
  };
  return (
    <form className="quetes__formulaire" onSubmit={envoyer}>
      <h3 className="quetes__titre">Nouvelle quete</h3>
      <label>
        Titre
        <input className="champ-parchemin" value={titre} maxLength={80} onChange={(e) => setTitre(e.target.value)} autoFocus required />
      </label>
      <label>
        Objectif
        <textarea className="champ-parchemin" value={objectif} maxLength={500} rows={3} onChange={(e) => setObjectif(e.target.value)} required />
      </label>
      <label>
        Description (facultative)
        <textarea className="champ-parchemin" value={description} maxLength={4000} rows={5} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="quetes__actions">
        <button type="submit" className="bouton" disabled={!titre.trim() || !objectif.trim()}>
          Donner la quete
        </button>
        <button type="button" className="bouton bouton--discret" onClick={() => surFin()}>
          Annuler
        </button>
      </div>
      <p className="quetes__astuce">Astuce : dans la discussion, /quete Titre | Objectif</p>
    </form>
  );
}

/** (MJ) Terminer, echouer, rouvrir ou retirer la quete affichee. */
function ActionsMJ({ quete }: { quete: Quete }) {
  const [confirmer, setConfirmer] = useState(false);
  return (
    <div className="quetes__actions">
      {quete.statut !== "terminee" && (
        <button type="button" className="bouton" onClick={() => jeu.changerQuete(quete.id, "terminee")}>
          Terminer
        </button>
      )}
      {quete.statut !== "echouee" && (
        <button type="button" className="bouton" onClick={() => jeu.changerQuete(quete.id, "echouee")}>
          Echec
        </button>
      )}
      {quete.statut !== "en-cours" && (
        <button type="button" className="bouton" onClick={() => jeu.changerQuete(quete.id, "en-cours")}>
          Rouvrir
        </button>
      )}
      <button
        type="button"
        className="bouton bouton--discret"
        onClick={() => (confirmer ? jeu.retirerQuete(quete.id) : setConfirmer(true))}
        onPointerLeave={() => setConfirmer(false)}
      >
        {confirmer ? "Vraiment ?" : "Retirer"}
      </button>
    </div>
  );
}

/**
 * Le journal de quetes (touche L), facon WoW : la liste a gauche (titres
 * jaunes), le detail a droite sur un parchemin (texte noir). Les joueurs le
 * lisent ; seul le MJ ajoute ou modifie des quetes, et chaque changement
 * arrive en direct chez tout le monde.
 */
export function JournalQuetes({ position }: { position: { x: number; y: number } }) {
  const quetes = useJeu((e) => e.quetes);
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const [choisie, setChoisie] = useState<string | null>(null);
  const [redaction, setRedaction] = useState(false);
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, quetes: false } }));

  // Les quetes en cours d'abord (les plus recentes en haut), puis les autres.
  const ordre = [...quetes].sort((a, b) => Number(a.statut !== "en-cours") - Number(b.statut !== "en-cours") || b.creeLe.localeCompare(a.creeLe));
  const quete = ordre.find((q) => q.id === choisie) ?? ordre[0] ?? null;
  const enCours = quetes.filter((q) => q.statut === "en-cours").length;

  return (
    <Fenetre titre={`Journal de quetes (${enCours})`} classe="quetes" positionInitiale={position} surFermer={fermer}>
      <div className="quetes__corps">
        <nav className="quetes__liste" aria-label="Quetes">
          {ordre.length === 0 && <p className="quetes__vide">Aucune quete pour le moment.</p>}
          {ordre.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`quetes__entree quetes__entree--${q.statut}${q.id === quete?.id && !redaction ? " quetes__entree--choisie" : ""}`}
              onClick={() => {
                setChoisie(q.id);
                setRedaction(false);
              }}
            >
              <span className="quetes__entree-titre">{q.titre}</span>
              {STATUTS[q.statut] && <span className="quetes__entree-statut">({STATUTS[q.statut]})</span>}
            </button>
          ))}
          {estMJ && (
            <button type="button" className="bouton quetes__nouvelle" onClick={() => setRedaction(true)}>
              + Nouvelle quete
            </button>
          )}
        </nav>

        <article className="quetes__parchemin">
          {redaction ? (
            <NouvelleQuete
              surFin={(id) => {
                setRedaction(false);
                if (id) setChoisie(id);
              }}
            />
          ) : quete ? (
            <>
              <h3 className="quetes__titre">{quete.titre}</h3>
              {quete.statut !== "en-cours" && <p className={`quetes__statut quetes__statut--${quete.statut}`}>{quete.statut === "terminee" ? "Quete terminee" : "Quete echouee"}</p>}
              <h4 className="quetes__rubrique">Objectifs</h4>
              <p className="quetes__texte">{quete.objectif}</p>
              {quete.description && (
                <>
                  <h4 className="quetes__rubrique">Description</h4>
                  <p className="quetes__texte">{quete.description}</p>
                </>
              )}
              {estMJ && <ActionsMJ key={quete.id} quete={quete} />}
            </>
          ) : (
            <p className="quetes__texte quetes__texte--vide">{estMJ ? "Clique sur \"+ Nouvelle quete\" pour en donner une au groupe." : "Le MJ ne t'a encore confie aucune quete."}</p>
          )}
        </article>
      </div>
    </Fenetre>
  );
}
