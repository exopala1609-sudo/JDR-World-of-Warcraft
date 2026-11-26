import { niveauRequis, resolutionDuSort, sortDebloque, statistiquesIncantation } from "@partage/magie.js";
import { NOMS_CARACTERISTIQUES } from "@partage/creation.js";
import { jeu } from "@/core/jeu";
import { signe } from "@/core/journal";
import type { Personnage, SortConnu } from "@/core/types";

// Ce qui sert aux sorts partout dans l'interface (fenetre Actions & Sorts,
// barre d'actions, compendium) : rang, deblocage, infobulle facon WoW.

const nomCarac = (cle: string) => (NOMS_CARACTERISTIQUES as Record<string, string>)[cle] ?? cle;

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
