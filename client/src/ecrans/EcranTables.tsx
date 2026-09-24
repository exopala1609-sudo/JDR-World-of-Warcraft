import { useState, type FormEvent } from "react";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";

/** Choix de la table (l'equivalent de l'ecran de selection du royaume). */
export function EcranTables() {
  const tables = useJeu((e) => e.tables);
  const profil = useJeu((e) => e.profil);
  const liaison = useJeu((e) => e.liaison);
  const [nom, setNom] = useState("");

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if ((await jeu.demander(EVENEMENTS.TABLE_CREER, { nom })).ok) setNom("");
  };

  return (
    <div className="ecran-accueil">
      <div className="accueil cadre">
        <h1 className="titre-or accueil__titre">Choisir une table</h1>
        <p className="accueil__sous-titre">
          {profil?.role === "mj" ? "Maitre du Jeu" : profil?.pseudo} - {liaison === "connecte" ? "connecte" : "connexion..."}
        </p>
        <div className="accueil__liste">
          {tables.length === 0 && <p className="accueil__sous-titre">Aucune table pour l'instant.</p>}
          {tables.map((t) => (
            <button key={t.id} type="button" className="accueil__table" onClick={() => jeu.rejoindre(t.id)}>
              {t.nom}
            </button>
          ))}
        </div>
        {profil?.role === "mj" && (
          <form onSubmit={creer} style={{ display: "flex", gap: 8 }}>
            <input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nouvelle table" maxLength={60} />
            <button className="bouton" type="submit">
              Creer
            </button>
          </form>
        )}
        <button className="bouton" type="button" onClick={() => jeu.deconnecter()}>
          Retour
        </button>
      </div>
    </div>
  );
}
