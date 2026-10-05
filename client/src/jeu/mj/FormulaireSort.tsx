import { useState, type FormEvent } from "react";
import { CARACTERISTIQUES } from "@partage/dnd5e.js";
import { NOMS_CARACTERISTIQUES } from "@partage/creation.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { TYPES_DEGATS } from "@partage/types-degats.js";
import { jeu } from "@/core/jeu";
import type { SortConnu } from "@/core/types";
import { ChampIcone } from "./SelecteurIcone";

const ECOLES = ["abjuration", "divination", "enchantement", "evocation", "illusion", "invocation", "necromancie", "transmutation"];

type Sort = Omit<SortConnu, "id" | "source" | "modifiable">;

const VIDE: Sort = {
  nom: "",
  niveau: 1,
  ecole: "evocation",
  incantation: "1 action",
  portee: "",
  composantes: "V, S",
  duree: "Instantanee",
  concentration: false,
  rituel: false,
  description: "",
  resolution: "attaque",
};

/**
 * Creer (ou modifier) un sort depuis le Compendium du MJ. Le serveur verifie
 * chaque champ (memes regles que les fichiers JSON) et l'ecrit dans
 * compendium/mes-sorts.json, modifiable ensuite au Bloc-notes.
 *  - "modele" absent : nouveau sort vierge ;
 *  - modele "modifiable" (deja dans mes-sorts.json) : modification ;
 *  - autre modele (ecrit dans un de tes fichiers) : copie a personnaliser.
 */
export function FormulaireSort({ modele, surFin }: { modele: SortConnu | null; surFin: (id?: string) => void }) {
  const modification = Boolean(modele?.modifiable);
  const [s, setS] = useState<Sort>(() => {
    if (!modele) return VIDE;
    const { id: _id, source: _source, modifiable: _m, ...reste } = modele;
    return modification ? reste : { ...reste, nom: `${modele.nom} (copie)` };
  });
  const [envoi, setEnvoi] = useState(false);
  const changer = (changement: Partial<Sort>) => setS((avant) => ({ ...avant, ...changement }));

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    // Les champs vides facultatifs ne partent pas (le serveur les refuserait vides).
    const sort: Record<string, unknown> = { ...s, ...(modification ? { id: modele!.id } : {}) };
    for (const cle of ["icone", "parNiveauSuperieur", "soins", "sauvegarde"]) if (!sort[cle]) delete sort[cle];
    if (!s.degats?.formule) delete sort.degats;
    if (s.resolution !== "sauvegarde") delete sort.sauvegarde;
    const r = await jeu.demander(EVENEMENTS.SORT_ENREGISTRER, { sort, ...(modification ? { remplace: modele!.id } : {}) });
    setEnvoi(false);
    if (r.ok) {
      jeu.journaliser(`Compendium : sort ${s.nom} ${modification ? "modifie" : "cree"} (compendium/mes-sorts.json).`);
      surFin((r.sort as SortConnu).id);
    }
  };

  return (
    <form className="formulaire-monstre formulaire-sort" onSubmit={enregistrer}>
      <h3 className="bestiaire__nom">{modification ? `Modifier : ${modele!.nom}` : modele ? `Copie de : ${modele.nom}` : "Nouveau sort"}</h3>
      <div className="formulaire-monstre__grille">
        <label className="formulaire-monstre__large">
          Nom
          <input className="champ-parchemin" value={s.nom} maxLength={80} required autoFocus onChange={(e) => changer({ nom: e.target.value })} />
        </label>
        <div className="formulaire-monstre__large">
          <span className="formulaire-monstre__libelle">Icone</span>
          <ChampIcone valeur={s.icone ?? null} defaut="sort" categorie="spell_" surChange={(icone) => changer({ icone: icone ?? undefined })} />
        </div>
        <label>
          Niveau
          <select className="champ-parchemin" value={s.niveau} onChange={(e) => changer({ niveau: Number(e.target.value) })}>
            {Array.from({ length: 10 }, (_, n) => (
              <option key={n} value={n}>
                {n === 0 ? "Sort mineur (0)" : `Niveau ${n}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ecole
          <select className="champ-parchemin" value={s.ecole} onChange={(e) => changer({ ecole: e.target.value })}>
            {ECOLES.map((ecole) => (
              <option key={ecole} value={ecole}>
                {ecole}
              </option>
            ))}
          </select>
        </label>
        <label>
          Temps d'incantation
          <input className="champ-parchemin" value={s.incantation} maxLength={60} onChange={(e) => changer({ incantation: e.target.value })} />
        </label>
        <label>
          Portee
          <input className="champ-parchemin" value={s.portee} maxLength={60} placeholder="36 metres, Contact..." onChange={(e) => changer({ portee: e.target.value })} />
        </label>
        <label>
          Composantes
          <input className="champ-parchemin" value={s.composantes} maxLength={120} onChange={(e) => changer({ composantes: e.target.value })} />
        </label>
        <label>
          Duree
          <input className="champ-parchemin" value={s.duree} maxLength={60} onChange={(e) => changer({ duree: e.target.value })} />
        </label>
        <label className="formulaire-sort__case">
          <input type="checkbox" checked={s.concentration} onChange={(e) => changer({ concentration: e.target.checked })} />
          Concentration (aura sous le portrait du lanceur)
        </label>
        <label className="formulaire-sort__case">
          <input type="checkbox" checked={s.rituel} onChange={(e) => changer({ rituel: e.target.checked })} />
          Rituel
        </label>
        <label>
          Resolution
          <select className="champ-parchemin" value={s.resolution ?? "attaque"} onChange={(e) => changer({ resolution: e.target.value as Sort["resolution"] })}>
            <option value="attaque">Jet d'attaque de sort</option>
            <option value="sauvegarde">Jet de sauvegarde de la cible</option>
            <option value="automatique">Automatique (touche toujours, soins)</option>
          </select>
        </label>
        {s.resolution === "sauvegarde" && (
          <label>
            Sauvegarde de
            <select className="champ-parchemin" value={s.sauvegarde ?? "dexterite"} onChange={(e) => changer({ sauvegarde: e.target.value })}>
              {CARACTERISTIQUES.map((c) => (
                <option key={c} value={c}>
                  {(NOMS_CARACTERISTIQUES as Record<string, string>)[c]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Degats (formule)
          <input
            className="champ-parchemin"
            value={s.degats?.formule ?? ""}
            maxLength={40}
            placeholder="8d6 (vide : aucun)"
            onChange={(e) => changer({ degats: e.target.value ? { formule: e.target.value.trim(), type: s.degats?.type ?? "feu" } : undefined })}
          />
        </label>
        <label>
          Type de degats (couleur du texte flottant)
          <select
            className="champ-parchemin"
            value={s.degats?.type ?? "feu"}
            disabled={!s.degats}
            onChange={(e) => s.degats && changer({ degats: { ...s.degats, type: e.target.value } })}
          >
            {Object.entries(TYPES_DEGATS).map(([cle, { nom }]) => (
              <option key={cle} value={cle}>
                {nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Soins (formule)
          <input className="champ-parchemin" value={s.soins ?? ""} maxLength={40} placeholder="1d8 (vide : aucun)" onChange={(e) => changer({ soins: e.target.value.trim() || undefined })} />
        </label>
        <label title="Lance avec un emplacement plus haut : ajoute pour chaque niveau au-dessus du sien">
          Par niveau superieur
          <input
            className="champ-parchemin"
            value={s.parNiveauSuperieur ?? ""}
            maxLength={40}
            placeholder="1d6 (vide : rien)"
            onChange={(e) => changer({ parNiveauSuperieur: e.target.value.trim() || undefined })}
          />
        </label>
      </div>
      <label className="formulaire-monstre__description">
        Description (la regle complete, lue en depliant le sort)
        <textarea className="champ-parchemin" rows={4} maxLength={4000} value={s.description} onChange={(e) => changer({ description: e.target.value })} />
      </label>
      <div className="quetes__actions">
        <button type="submit" className="bouton" disabled={envoi || !s.nom.trim()}>
          Enregistrer
        </button>
        <button type="button" className="bouton bouton--discret" onClick={() => surFin()}>
          Annuler
        </button>
      </div>
    </form>
  );
}
