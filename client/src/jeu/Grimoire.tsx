import { useState } from "react";
import { niveauDeSortMax, niveauRequis, resolutionDuSort, sortDebloque, statistiquesIncantation } from "@partage/magie.js";
import { NOMS_CARACTERISTIQUES } from "@partage/creation.js";
import { jeu, useJeu } from "@/core/jeu";
import { signe } from "@/core/journal";
import { iconeObjet } from "@/core/medias";
import type { Personnage, SortConnu } from "@/core/types";
import { Fenetre } from "@/ui/Fenetre";
import { preparerGlisser } from "@/ui/glisser";
import { avecInfobulle } from "@/ui/InfoBulle";

const PAR_PAGE = 6; // 6 sorts par page, 2 pages visibles : 12 sorts par double page

const nomCarac = (cle: string) => (NOMS_CARACTERISTIQUES as Record<string, string>)[cle] ?? cle;
const referenceDuSort = (sort: SortConnu) => sort.source ?? sort.id; // ce que retient la barre d'actions

/** "Sort de niveau 1 - Evocation" / "Sort mineur - Evocation" */
export const rangDuSort = (sort: SortConnu) => `${sort.niveau === 0 ? "Sort mineur" : `Niveau ${sort.niveau}`} - ${sort.ecole}`;

/** Le sort est-il lancable par ce personnage (assez de niveau) ? */
export function etatDuSort(p: Personnage, sort: SortConnu) {
  const progression = jeu.classeDe(p)?.progressionSorts;
  return { debloque: sortDebloque(sort, p.niveau, progression), requis: niveauRequis(sort, progression) };
}

/** Nom affiche d'une ressource (Mana...) : celui du personnage, sinon celui du referentiel. */
function nomRessource(p: Personnage | null, cle: string) {
  return p?.ressources.find((r) => r.cle === cle)?.nom ?? jeu.lire().referentiel?.ressources.find((m) => m.id === cle)?.nom ?? cle;
}

/** Infobulle de sort facon WoW : nom, rang, incantation/portee, cout, effet, description doree. */
export function InfobulleSort({ sort, p }: { sort: SortConnu; p: Personnage | null }) {
  const stats = p ? statistiquesIncantation(p, jeu.classeDe(p)) : null;
  const resolution = resolutionDuSort(sort);
  const etat = p ? etatDuSort(p, sort) : null;
  return (
    <>
      <div className="infobulle__titre">{sort.nom}</div>
      <div className="infobulle__ligne--gris">{rangDuSort(sort)}</div>
      {sort.cout && (
        <div>
          {sort.cout.quantite} {nomRessource(p, sort.cout.ressource)}
        </div>
      )}
      <div className="infobulle__deux-colonnes">
        <span>{sort.incantation}</span>
        <span>{sort.portee}</span>
      </div>
      <div className="infobulle__ligne--gris">
        {sort.composantes} - {sort.duree}
        {sort.concentration ? " (concentration)" : ""}
        {sort.rituel ? " - rituel" : ""}
      </div>
      {resolution === "attaque" && <div>Attaque de sort{stats ? ` : ${signe(stats.attaque)} au toucher` : ""}</div>}
      {resolution === "sauvegarde" && (
        <div>
          Sauvegarde{sort.sauvegarde ? ` de ${nomCarac(sort.sauvegarde)}` : ""}
          {stats ? ` - DD ${stats.dd}` : ""}
        </div>
      )}
      {sort.degats && (
        <div className="infobulle__ligne--vert">
          Degats : {sort.degats.formule} ({sort.degats.type})
        </div>
      )}
      {sort.soins && (
        <div className="infobulle__ligne--vert">
          Soins : {sort.soins}
          {stats ? ` + ${nomCarac(stats.caracteristique)}` : ""}
        </div>
      )}
      {sort.description && <div className="infobulle__ligne--or">"{sort.description}"</div>}
      {etat && !etat.debloque && <div className="infobulle__ligne--rouge">Requiert le niveau {etat.requis ?? "?"}</div>}
    </>
  );
}

/** Une entree du grimoire : icone (a glisser sur la barre d'actions) + nom + rang. */
function EntreeSort({ sort, p, modifiable }: { sort: SortConnu; p: Personnage; modifiable: boolean }) {
  const { debloque, requis } = etatDuSort(p, sort);
  const lancer = () => modifiable && debloque && jeu.lancerSort(p.id, referenceDuSort(sort));
  return (
    <div className={`sort${debloque ? "" : " sort--verrouille"}`}>
      <div
        className={`case sort__icone${modifiable ? " case--deplacable" : ""}`}
        // Meme glisser-deposer que les objets du sac (sprint 7) : seule la "charge" change.
        // On peut aussi glisser un sort verrouille : il attendra, grise, sur la barre.
        onPointerDown={(e) => modifiable && preparerGlisser(e, { origine: "grimoire", sort, idPersonnage: p.id })}
        onClick={lancer}
        {...avecInfobulle(() => (
          <>
            <InfobulleSort sort={sort} p={p} />
            {modifiable && debloque && <div className="infobulle__ligne--vert">Clic : lancer. Glisse l'icone sur ta barre d'actions.</div>}
            {modifiable && !debloque && <div className="infobulle__ligne--gris">Tu peux deja le placer sur ta barre d'actions.</div>}
          </>
        ))}
      >
        <img src={iconeObjet(sort)} alt="" />
      </div>
      <div className="sort__texte">
        <span className="sort__nom">{sort.nom}</span>
        <span className="sort__rang">{debloque ? rangDuSort(sort) : `Debloque au niveau ${requis ?? "?"}`}</span>
      </div>
    </div>
  );
}

/**
 * Le grimoire (touche P), facon "Livre des sorts" de WoW : un livre ouvert,
 * deux pages de parchemin, 6 sorts par page. Les fleches tournent les pages.
 * Les sorts trop puissants pour le niveau du personnage sont grises.
 */
export function Grimoire({ position }: { position: { x: number; y: number } }) {
  const p = useJeu((e) => jeu.personnageDesSacs(e));
  const modifiable = useJeu((e) => Boolean(p && (e.profil?.role === "mj" || jeu.mesPersonnages(e).some((m) => m.id === p.id))));
  const [planche, setPlanche] = useState(0); // numero de la double page
  const [feuille, setFeuille] = useState<{ sens: "suivante" | "precedente"; n: number } | null>(null);
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, grimoire: false } }));

  if (!p) {
    return (
      <Fenetre titre="Grimoire" classe="grimoire" positionInitiale={position} surFermer={fermer}>
        <p className="grimoire__vide">Aucun personnage.</p>
      </Fenetre>
    );
  }

  const sorts = [...p.grimoire].sort((a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom, "fr"));
  const planches = Math.max(1, Math.ceil(sorts.length / (PAR_PAGE * 2)));
  const actuelle = Math.min(planche, planches - 1);
  const debut = actuelle * PAR_PAGE * 2;
  const pages = [sorts.slice(debut, debut + PAR_PAGE), sorts.slice(debut + PAR_PAGE, debut + PAR_PAGE * 2)];
  const classe = jeu.classeDe(p);
  const stats = statistiquesIncantation(p, classe);
  const maximum = niveauDeSortMax(p.niveau, classe?.progressionSorts);

  const tourner = (sens: "suivante" | "precedente") => {
    const cible = actuelle + (sens === "suivante" ? 1 : -1);
    if (cible < 0 || cible >= planches) return;
    setPlanche(cible);
    setFeuille({ sens, n: Date.now() }); // la feuille qui tourne (animation CSS)
  };

  return (
    <Fenetre titre={`Grimoire - ${p.nom}`} classe="grimoire" positionInitiale={position} surFermer={fermer}>
      <div className="grimoire__bandeau">
        <span>{nomCarac(stats.caracteristique)}</span>
        <span>Attaque de sort {signe(stats.attaque)}</span>
        <span>DD des sauvegardes {stats.dd}</span>
        <span>{maximum === 0 ? "Sorts mineurs seulement" : `Sorts jusqu'au niveau ${maximum}`}</span>
      </div>
      <div className="livre">
        {pages.map((page, i) => (
          <div key={i} className={`livre__page livre__page--${i === 0 ? "gauche" : "droite"}`}>
            {i === 0 && sorts.length === 0 && (
              <p className="grimoire__vide">
                Aucun sort connu.
                <br />
                Le MJ t'enseigne de nouveaux sorts au fil de l'aventure.
              </p>
            )}
            {page.map((sort) => (
              <EntreeSort key={sort.id} sort={sort} p={p} modifiable={modifiable} />
            ))}
            <span className="livre__folio">{actuelle * 2 + i + 1}</span>
          </div>
        ))}
        {feuille && (
          <div key={feuille.n} className={`livre__feuille livre__feuille--${feuille.sens}`} onAnimationEnd={() => setFeuille(null)} aria-hidden="true" />
        )}
      </div>
      <div className="grimoire__pied">
        <button type="button" className="bouton-page" onClick={() => tourner("precedente")} disabled={actuelle === 0} aria-label="Page precedente">
          {"<"}
        </button>
        <span>
          Page {actuelle + 1} / {planches}
        </span>
        <button type="button" className="bouton-page" onClick={() => tourner("suivante")} disabled={actuelle >= planches - 1} aria-label="Page suivante">
          {">"}
        </button>
      </div>
    </Fenetre>
  );
}
