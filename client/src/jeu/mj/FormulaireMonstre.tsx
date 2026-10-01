import { useState, type FormEvent } from "react";
import { CARACTERISTIQUES } from "@partage/dnd5e.js";
import { NOMS_CARACTERISTIQUES } from "@partage/creation.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu } from "@/core/jeu";
import type { Monstre } from "@/core/types";

type Attaque = Monstre["attaques"][number];

export const TAILLES: [number, string][] = [
  [1, "Petite / moyenne (1 case)"],
  [2, "Grande (2 x 2)"],
  [3, "Tres grande (3 x 3)"],
  [4, "Gigantesque (4 x 4)"],
];

const VIDE: Omit<Monstre, "id"> = {
  nom: "",
  type: "",
  puissance: "",
  niveau: 1,
  pv: 10,
  classeArmure: 12,
  vitesse: "9 m",
  taille: 1,
  caracteristiques: Object.fromEntries(CARACTERISTIQUES.map((c) => [c, 10])),
  attaques: [],
  butin: [],
  description: "",
};

/**
 * Creer (ou modifier) un monstre / PNJ depuis le jeu. Le serveur verifie
 * chaque champ (memes regles que les fichiers JSON) et l'ecrit dans
 * compendium/mes-monstres.json : il reste ensuite modifiable au Bloc-notes.
 *  - "modele" absent : nouveau monstre vierge ;
 *  - modele "modifiable" : modification (on garde son identifiant) ;
 *  - autre modele : copie a personnaliser ("Dupliquer").
 */
export function FormulaireMonstre({ modele, surFin }: { modele: Monstre | null; surFin: (id?: string) => void }) {
  const modification = Boolean(modele?.modifiable);
  const [m, setM] = useState<Omit<Monstre, "id">>(() => {
    if (!modele) return VIDE;
    const { id: _id, modifiable: _m, ...reste } = modele;
    return modification ? reste : { ...reste, nom: `${modele.nom} (copie)` };
  });
  const [envoi, setEnvoi] = useState(false);
  const changer = (changement: Partial<Omit<Monstre, "id">>) => setM((avant) => ({ ...avant, ...changement }));
  const changerAttaque = (index: number, changement: Partial<Attaque>) =>
    changer({ attaques: m.attaques.map((a, i) => (i === index ? { ...a, ...changement } : a)) });

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    // "22" -> 22 (nombre fixe) ; "5d8+5" reste une formule tiree a chaque invocation.
    const pv = /^\d+$/.test(String(m.pv).trim()) ? Number(m.pv) : String(m.pv).trim();
    const monstre = { ...m, pv, ...(modification ? { id: modele!.id } : {}) };
    const r = await jeu.demander(EVENEMENTS.BESTIAIRE_ENREGISTRER, { monstre, ...(modification ? { remplace: modele!.id } : {}) });
    setEnvoi(false);
    if (r.ok) {
      jeu.journaliser(`Bestiaire : ${m.nom} ${modification ? "modifie" : "cree"} (compendium/mes-monstres.json).`);
      surFin((r.monstre as Monstre).id);
    }
  };

  return (
    <form className="formulaire-monstre" onSubmit={enregistrer}>
      <h3 className="bestiaire__nom">{modification ? `Modifier : ${modele!.nom}` : "Nouveau monstre ou PNJ"}</h3>
      <div className="formulaire-monstre__grille">
        <label className="formulaire-monstre__large">
          Nom
          <input className="champ-parchemin" value={m.nom} maxLength={50} required autoFocus onChange={(e) => changer({ nom: e.target.value })} />
        </label>
        <label>
          Type
          <input className="champ-parchemin" value={m.type} maxLength={60} placeholder="Humanoide, Bete..." onChange={(e) => changer({ type: e.target.value })} />
        </label>
        <label>
          Puissance
          <input className="champ-parchemin" value={m.puissance} maxLength={20} placeholder="FP 1/2" onChange={(e) => changer({ puissance: e.target.value })} />
        </label>
        <label>
          Points de vie
          <input className="champ-parchemin" value={m.pv} maxLength={20} placeholder="22 ou 5d8+5" required onChange={(e) => changer({ pv: e.target.value })} />
        </label>
        <label>
          Classe d'armure
          <input className="champ-parchemin" type="number" min={1} max={40} value={m.classeArmure} onChange={(e) => changer({ classeArmure: Number(e.target.value) })} />
        </label>
        <label>
          Niveau
          <input className="champ-parchemin" type="number" min={1} max={20} value={m.niveau} onChange={(e) => changer({ niveau: Number(e.target.value) })} />
        </label>
        <label>
          Vitesse
          <input className="champ-parchemin" value={m.vitesse} maxLength={40} onChange={(e) => changer({ vitesse: e.target.value })} />
        </label>
        <label>
          Taille du pion
          <select className="champ-parchemin" value={m.taille} onChange={(e) => changer({ taille: Number(e.target.value) })}>
            {TAILLES.map(([valeur, nom]) => (
              <option key={valeur} value={valeur}>
                {nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jeton (image)
          <input
            className="champ-parchemin"
            value={m.jeton ?? ""}
            maxLength={80}
            placeholder="nom du fichier dans jetons/"
            onChange={(e) => changer({ jeton: e.target.value.replace(/\.[a-z0-9]+$/i, "").trim() || undefined })}
          />
        </label>
      </div>

      <div className="formulaire-monstre__caracs">
        {CARACTERISTIQUES.map((c) => (
          <label key={c}>
            {(NOMS_CARACTERISTIQUES as Record<string, string>)[c].slice(0, 3).toUpperCase()}
            <input
              className="champ-parchemin"
              type="number"
              min={1}
              max={30}
              value={m.caracteristiques[c]}
              onChange={(e) => changer({ caracteristiques: { ...m.caracteristiques, [c]: Number(e.target.value) } })}
            />
          </label>
        ))}
      </div>

      <h4 className="bestiaire__rubrique">Actions</h4>
      {m.attaques.map((a, i) => (
        <div key={i} className="formulaire-monstre__attaque">
          <input className="champ-parchemin" value={a.nom} placeholder="Nom (Morsure)" required onChange={(e) => changerAttaque(i, { nom: e.target.value })} />
          <input className="champ-parchemin" type="number" value={a.toucher} title="Bonus au toucher" onChange={(e) => changerAttaque(i, { toucher: Number(e.target.value) })} />
          <input className="champ-parchemin" value={a.degats} placeholder="1d6+2" required onChange={(e) => changerAttaque(i, { degats: e.target.value })} />
          <input className="champ-parchemin" value={a.type} placeholder="perforant" onChange={(e) => changerAttaque(i, { type: e.target.value })} />
          <button type="button" className="menu-mj__retirer" onClick={() => changer({ attaques: m.attaques.filter((_, j) => j !== i) })} aria-label="Retirer l'attaque">
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="menu-mj__retirer" onClick={() => changer({ attaques: [...m.attaques, { nom: "", toucher: 3, degats: "1d6", type: "" }] })}>
        + Ajouter une attaque
      </button>

      <label className="formulaire-monstre__description">
        Description
        <textarea className="champ-parchemin" rows={3} maxLength={2000} value={m.description} onChange={(e) => changer({ description: e.target.value })} />
      </label>
      <div className="quetes__actions">
        <button type="submit" className="bouton" disabled={envoi || !m.nom.trim()}>
          Enregistrer
        </button>
        <button type="button" className="bouton bouton--discret" onClick={() => surFin()}>
          Annuler
        </button>
      </div>
    </form>
  );
}
