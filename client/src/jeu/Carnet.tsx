import { useEffect, useState } from "react";
import { jeu, useJeu } from "@/core/jeu";
import type { Note } from "@/core/types";
import { Fenetre } from "@/ui/Fenetre";

/** "le 3 octobre a 21:40" */
const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** La page de droite : une note ouverte, modifiable. */
function PageNote({ note, surFin }: { note: Note | null; surFin: (id: string | null) => void }) {
  const [titre, setTitre] = useState(note?.titre ?? "");
  const [texte, setTexte] = useState(note?.texte ?? "");
  const [etat, setEtat] = useState<"" | "envoi" | "ok">("");
  const [supprimer, setSupprimer] = useState(false);
  const modifiee = titre !== (note?.titre ?? "") || texte !== (note?.texte ?? "");

  const enregistrer = async () => {
    if (!titre.trim()) return;
    setEtat("envoi");
    const enregistree = await jeu.enregistrerNote(titre.trim(), texte, note?.id);
    setEtat(enregistree ? "ok" : "");
    if (enregistree && !note) surFin(enregistree.id);
  };

  return (
    <div className="carnet__page-note">
      <input
        className="carnet__titre"
        value={titre}
        maxLength={80}
        placeholder="Titre de la note"
        autoFocus={!note}
        onChange={(e) => {
          setTitre(e.target.value);
          setEtat("");
        }}
      />
      <textarea
        className="carnet__texte"
        value={texte}
        maxLength={10000}
        placeholder="Ecris ici : indices, noms, plans, rancunes..."
        onChange={(e) => {
          setTexte(e.target.value);
          setEtat("");
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            enregistrer();
          }
        }}
      />
      <div className="carnet__actions">
        <button type="button" className="bouton" disabled={!titre.trim() || etat === "envoi" || (!modifiee && Boolean(note))} onClick={enregistrer}>
          Enregistrer
        </button>
        {note && (
          <button
            type="button"
            className={`bouton bouton--discret${supprimer ? " bouton--danger" : ""}`}
            onClick={() => {
              if (!supprimer) return setSupprimer(true);
              jeu.supprimerNote(note.id);
              surFin(null);
            }}
          >
            {supprimer ? "Vraiment ?" : "Dechirer la page"}
          </button>
        )}
        <span className="carnet__etat">
          {etat === "ok" ? "Enregistre." : modifiee ? "Modifications non enregistrees (Ctrl + S)" : note ? `Modifiee ${quand(note.modifieLe)}` : ""}
        </span>
      </div>
    </div>
  );
}

/**
 * Le carnet de notes PRIVE (touche N), facon livret de cuir : a gauche la
 * liste des notes, a droite la note ouverte. Le serveur ne l'envoie qu'a son
 * auteur : ni les autres joueurs, ni le MJ ne peuvent le lire (et le carnet du
 * MJ, a l'inverse, reste invisible des joueurs).
 */
export function Carnet({ position }: { position: { x: number; y: number } }) {
  const notes = useJeu((e) => e.notes);
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const [ouverte, setOuverte] = useState<string | null>(null); // id, ou "nouvelle"
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, carnet: false } }));

  useEffect(() => {
    if (notes === null) jeu.chargerNotes();
  }, [notes]);

  const liste = notes ?? [];
  const note = ouverte === "nouvelle" ? null : (liste.find((n) => n.id === ouverte) ?? liste[0] ?? null);
  const nouvelle = ouverte === "nouvelle" || liste.length === 0;

  return (
    <Fenetre titre={estMJ ? "Carnet du Maitre du Jeu" : "Mon carnet"} classe="carnet" positionInitiale={position} surFermer={fermer}>
      <p className="carnet__prive">Prive : personne d'autre ne peut lire ce carnet{estMJ ? "" : ", pas meme le MJ"}.</p>
      <div className="livre carnet__livre">
        <div className="livre__page livre__page--gauche carnet__sommaire">
          <button type="button" className="carnet__nouvelle" onClick={() => setOuverte("nouvelle")}>
            + Nouvelle note
          </button>
          {notes === null && <p className="carnet__vide">Ouverture du carnet...</p>}
          {notes !== null && liste.length === 0 && <p className="carnet__vide">Aucune note pour l'instant.</p>}
          {liste.map((n) => (
            <button key={n.id} type="button" className={`carnet__entree${!nouvelle && note?.id === n.id ? " carnet__entree--ouverte" : ""}`} onClick={() => setOuverte(n.id)}>
              <span className="carnet__entree-titre">{n.titre}</span>
              <span className="carnet__entree-date">{quand(n.modifieLe)}</span>
            </button>
          ))}
        </div>
        <div className="livre__page livre__page--droite">
          {notes !== null && <PageNote key={nouvelle ? "nouvelle" : note?.id} note={nouvelle ? null : note} surFin={(id) => setOuverte(id)} />}
        </div>
      </div>
    </Fenetre>
  );
}
