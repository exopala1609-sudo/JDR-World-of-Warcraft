import { useEffect, useState } from "react";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import { iconeObjet, urlIcone } from "@/core/medias";
import { InfobulleSort, rangDuSort } from "@/jeu/Grimoire";
import { InfobulleObjet } from "@/jeu/Sacs";
import { Fenetre } from "@/ui/Fenetre";
import { avecInfobulle } from "@/ui/InfoBulle";
import { preparerGlisser } from "@/ui/glisser";
import type { SortConnu } from "@/core/types";
import { FormulaireSort } from "./FormulaireSort";
import { SelecteurIcone } from "./SelecteurIcone";

type Onglet = "objets" | "sorts" | "etats";
const ONGLETS: { cle: Onglet; nom: string }[] = [
  { cle: "objets", nom: "Objets" },
  { cle: "sorts", nom: "Sorts" },
  { cle: "etats", nom: "Auras" },
];

/**
 * Le Compendium du MJ : tout ce qu'il a ecrit dans ses fichiers JSON.
 * Le "destinataire" est un personnage de la table (par defaut, celui qu'on a
 * cible en cliquant sur son cadre ou son pion), ou le coffre ouvert.
 */
export function FenetreCompendium({ position }: { position: { x: number; y: number } }) {
  const compendium = useJeu((e) => e.compendium);
  const personnages = useJeu((e) => e.personnages);
  const selection = useJeu((e) => e.selection);
  const butin = useJeu((e) => e.butin);
  const [onglet, setOnglet] = useState<Onglet>("objets");
  const [recherche, setRecherche] = useState("");
  const [cible, setCible] = useState<string>("");
  const [quantite, setQuantite] = useState(1);
  // Le formulaire de sort ouvert : nouveau (modele null), modification ou copie.
  const [edition, setEdition] = useState<{ modele: SortConnu | null } | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  // Le selecteur d'icones ouvert pour un objet ou un sort (clic sur son icone).
  const [choixIcone, setChoixIcone] = useState<{ genre: "objets" | "sorts"; id: string; icone: string | null } | null>(null);
  const changerIcone = async (icone: string | null) => {
    if (!choixIcone) return;
    const r = await jeu.demander(EVENEMENTS.COMPENDIUM_ICONE, { genre: choixIcone.genre, id: choixIcone.id, icone });
    setChoixIcone(null);
    if (r.ok && Number(r.exemplaires) > 0) jeu.journaliser(`Icone changee aussi sur ${r.exemplaires} exemplaire(s) deja en jeu.`);
  };
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, compendium: false } }));

  useEffect(() => {
    jeu.chargerCompendium();
  }, []);
  // Cibler un personnage (clic sur son cadre ou son pion) en fait le destinataire.
  useEffect(() => {
    if (selection) setCible(selection);
  }, [selection]);

  const liste = Object.values(personnages).sort((a, b) => Number(a.proprietaire === null) - Number(b.proprietaire === null) || a.nom.localeCompare(b.nom, "fr"));
  const idCible = personnages[cible] ? cible : (liste[0]?.id ?? "");
  const nomCible = personnages[idCible]?.nom ?? "?";
  const filtre = recherche.trim().toLocaleLowerCase("fr");
  const garder = (nom: string) => !filtre || nom.toLocaleLowerCase("fr").includes(filtre);

  return (
    <Fenetre titre="Compendium" classe="compendium-mj" positionInitiale={position} surFermer={fermer}>
      <div className="compendium-mj__barre">
        <div className="compendium-mj__onglets" role="tablist">
          {ONGLETS.map((o) => (
            <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle} className={`onglet${onglet === o.cle ? " onglet--actif" : ""}`} onClick={() => setOnglet(o.cle)}>
              {o.nom}
            </button>
          ))}
        </div>
        <input className="champ" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher..." aria-label="Rechercher" />
      </div>
      <div className="compendium-mj__cible">
        <label>
          Pour :
          <select className="champ" value={idCible} onChange={(e) => setCible(e.target.value)}>
            {liste.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
                {p.proprietaire ? ` (${p.proprietaire})` : " (PNJ)"}
              </option>
            ))}
          </select>
        </label>
        {onglet === "objets" && (
          <label>
            Quantite
            <input className="champ compendium-mj__quantite" type="number" min={1} max={999} value={quantite} onChange={(e) => setQuantite(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} />
          </label>
        )}
        {butin && onglet === "objets" && <span className="compendium-mj__coffre">Coffre ouvert : {butin.nom}</span>}
      </div>

      <div className="compendium-mj__liste">
        {!compendium && <p className="compendium-mj__vide">Chargement...</p>}
        {onglet === "objets" &&
          compendium?.objets
            .filter((o) => garder(o.nom))
            .map((o) => (
              <div key={o.id} className="compendium-mj__ligne" data-rarete={o.rarete}>
                <button
                  type="button"
                  className="case compendium-mj__icone compendium-mj__icone--choix"
                  data-rarete={o.rarete}
                  onClick={() => setChoixIcone({ genre: "objets", id: o.id, icone: o.icone ?? null })}
                  {...avecInfobulle(() => (
                    <>
                      <InfobulleObjet objet={{ ...o, quantite: 1 }} />
                      <div className="infobulle__ligne--vert">Clic : changer l'icone</div>
                    </>
                  ))}
                >
                  <img src={iconeObjet(o)} alt="" />
                </button>
                <span className="compendium-mj__nom texte-rarete">{o.nom}</span>
                <button
                  type="button"
                  className="compendium-mj__action"
                  disabled={!idCible}
                  onClick={() => jeu.demander(EVENEMENTS.INVENTAIRE_AJOUTER, { idPersonnage: idCible, idObjet: o.id, quantite })}
                >
                  Donner a {nomCible}
                </button>
                {butin && (
                  <button type="button" className="compendium-mj__action" onClick={() => jeu.demander(EVENEMENTS.BUTIN_AJOUTER, { idButin: butin.id, idObjet: o.id, quantite })}>
                    Dans le coffre
                  </button>
                )}
              </div>
            ))}
        {onglet === "sorts" && edition && <FormulaireSort modele={edition.modele} surFin={() => setEdition(null)} />}
        {onglet === "sorts" && !edition && (
          <div className="compendium-mj__outils">
            <button type="button" className="bouton" onClick={() => setEdition({ modele: null })}>
              + Nouveau sort
            </button>
            <span className="compendium-mj__aide">Glisse un sort (son nom) sur la fenetre Actions & Sorts d'un joueur, ou sur son cadre, pour le lui apprendre.</span>
          </div>
        )}
        {onglet === "sorts" &&
          !edition &&
          compendium?.sorts
            .filter((s) => garder(s.nom))
            .map((s) => (
              <div key={s.id} className="compendium-mj__ligne">
                <button
                  type="button"
                  className="case compendium-mj__icone compendium-mj__icone--choix"
                  onClick={() => setChoixIcone({ genre: "sorts", id: s.id, icone: s.icone ?? null })}
                  {...avecInfobulle(() => (
                    <>
                      <InfobulleSort sort={s} p={personnages[idCible] ?? null} />
                      <div className="infobulle__ligne--vert">Clic : changer l'icone</div>
                    </>
                  ))}
                >
                  <img src={iconeObjet(s)} alt="" />
                </button>
                <span
                  className="compendium-mj__nom compendium-mj__nom--glissable"
                  onPointerDown={(e) => preparerGlisser(e, { origine: "compendium-sort", sort: s })}
                  title="Glisse-le sur la fenetre Actions & Sorts d'un joueur (ou sur son cadre) pour le lui apprendre"
                >
                  {s.nom} <small>{rangDuSort(s)}</small>
                  {s.concentration && <small className="compendium-mj__tag">C</small>}
                </span>
                <button type="button" className="compendium-mj__action" onClick={() => setEdition({ modele: s })}>
                  {s.modifiable ? "Modifier" : "Dupliquer"}
                </button>
                {s.modifiable && (
                  <button
                    type="button"
                    className={`compendium-mj__action${aSupprimer === s.id ? " compendium-mj__action--danger" : ""}`}
                    onClick={() => {
                      if (aSupprimer !== s.id) return setASupprimer(s.id); // deux clics : pas de suppression par megarde
                      setASupprimer(null);
                      jeu.demander(EVENEMENTS.SORT_SUPPRIMER, { idSort: s.id });
                    }}
                  >
                    {aSupprimer === s.id ? "Confirmer ?" : "Supprimer"}
                  </button>
                )}
                <button type="button" className="compendium-mj__action" disabled={!idCible} onClick={() => jeu.demander(EVENEMENTS.GRIMOIRE_APPRENDRE, { idPersonnage: idCible, idSort: s.id })}>
                  Apprendre a {nomCible}
                </button>
              </div>
            ))}
        {onglet === "etats" &&
          compendium?.etats
            .filter((e) => garder(e.nom))
            .map((e) => (
              <div key={e.cle} className="compendium-mj__ligne">
                <span className={`aura aura--${e.nature} compendium-mj__aura`} {...avecInfobulle(() => <div>{e.description}</div>)}>
                  <img src={urlIcone(e.icone)} alt="" />
                </span>
                <span className={`compendium-mj__nom ${e.nature === "buff" ? "menu-mj__buff" : "menu-mj__debuff"}`}>
                  {e.nom} {e.officiel ? <small>(D&D 5e)</small> : null}
                </span>
                <button type="button" className="compendium-mj__action" disabled={!idCible} onClick={() => jeu.demander(EVENEMENTS.ETAT_POSER, { idPersonnage: idCible, cle: e.cle })}>
                  Poser sur {nomCible}
                </button>
              </div>
            ))}
      </div>
      <p className="compendium-mj__astuce">Clic sur une icone : en choisir une autre. Tes fichiers : dossier compendium/ du cloud. Apres modification : bouton "Recharger" de la barre MJ.</p>
      {choixIcone && <SelecteurIcone valeur={choixIcone.icone} surChoix={changerIcone} surFermer={() => setChoixIcone(null)} categorie={choixIcone.genre === "sorts" ? "spell_" : "inv_"} />}
    </Fenetre>
  );
}
