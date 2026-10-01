// Glisser-deposer des objets de l'interface (sacs, fiche, barre d'actions, butin).
//
// POURQUOI PAS L'API "Drag & Drop" HTML5 ?
//  - le navigateur dessine lui-meme l'image qui suit la souris (une copie
//    grisee, decalee quand l'interface est mise a l'echelle) et impose son
//    curseur : impossible d'avoir l'icone facon WoW ;
//  - si l'on lache HORS de la fenetre du navigateur, les evenements "drop"
//    n'arrivent pas et "dragend" donne des coordonnees (0, 0) sous Firefox :
//    c'est exactement le "curseur qui se perd" ;
//  - elle ne fonctionne pas au doigt (tablette).
//
// NOTRE METHODE : les "Pointer Events" + la CAPTURE du pointeur.
//  1. Appui sur un objet : rien ne se passe tant que la souris n'a pas bouge
//     de 5 px (un simple clic reste un clic). On bloque au passage le glisser
//     NATIF du navigateur (une image se "tire" toute seule) : sinon il
//     annulerait nos evenements (pointercancel) des le premier mouvement.
//  2. Au-dela : l'element "capture" le pointeur (setPointerCapture). Tant que
//     le bouton reste enfonce, TOUS les mouvements et le relachement lui sont
//     livres, meme au-dessus d'une autre fenetre, du Canvas de la carte... ou
//     en dehors de la fenetre du navigateur. Le Canvas ne recoit rien : aucun
//     risque de deplacer la carte ou un pion par erreur.
//  3. Une icone "fantome" suit la souris, dans une couche au-dessus de tout,
//     transparente aux clics (pointer-events: none).
//  4. Au relachement, on cherche sous la souris (document.elementsFromPoint)
//     la premiere "cible" declaree (attribut data-cible). Si elle accepte
//     l'objet, elle le recoit ; sinon (ou si l'on a lache dans le vide, hors
//     du navigateur, ou appuye sur Echap, ou change de fenetre), le glisser
//     est ANNULE : l'objet reste ou il etait. Rien n'est jamais perdu, et
//     c'est de toute facon le serveur qui deplace reellement l'objet.
import { useEffect, useSyncExternalStore } from "react";
import { iconeObjet } from "@/core/medias";
import type { Objet, SortConnu } from "@/core/types";
import { cacherInfobulle, versScene } from "./InfoBulle";

/** Ce que l'on transporte, et d'ou cela vient. */
export type Charge =
  | { origine: "sac"; objet: Objet; idPersonnage: string }
  | { origine: "equipement"; objet: Objet; idPersonnage: string; emplacement: string }
  | { origine: "butin"; objet: Objet; idButin: string }
  | { origine: "grimoire"; sort: SortConnu; idPersonnage: string } // un sort tire du grimoire (P)
  | { origine: "barre"; image: string; rarete?: string; idPersonnage: string; index: number };

/** L'image du fantome : l'icone de l'objet ou du sort transporte. */
function apparence(charge: Charge): { image: string; rarete?: string; quantite: number } {
  if (charge.origine === "grimoire") return { image: iconeObjet(charge.sort), quantite: 0 };
  if (charge.origine === "barre") return { image: charge.image, rarete: charge.rarete, quantite: 0 };
  return { image: iconeObjet(charge.objet), rarete: charge.objet.rarete, quantite: charge.objet.quantite };
}

type Cible = { accepte: (charge: Charge) => boolean; deposer: (charge: Charge) => void };
type EtatGlisser = { charge: Charge; x: number; y: number; cible: string | null; refusee: boolean } | null;

const SEUIL_PX = 5;
const cibles = new Map<string, Cible>();
let etat: EtatGlisser = null;
const abonnes = new Set<() => void>();
const publier = (nouvel: EtatGlisser) => {
  etat = nouvel;
  abonnes.forEach((rappel) => rappel());
};
const abonner = (rappel: () => void) => {
  abonnes.add(rappel);
  return () => {
    abonnes.delete(rappel);
  };
};

/** La cible sous la souris : la plus haute qui porte data-cible (acceptee ou non). */
function cibleSous(clientX: number, clientY: number, charge: Charge) {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    const id = (element as HTMLElement).dataset?.cible;
    if (id && cibles.has(id)) return { id, accepte: cibles.get(id)!.accepte(charge) };
  }
  return null;
}

/**
 * A appeler dans onPointerDown d'un objet deplacable. "surLacherDehors" :
 * ce qui se passe si on lache loin de toute cible (ex. retirer un raccourci).
 */
export function preparerGlisser(e: React.PointerEvent, charge: Charge, surLacherDehors?: () => void) {
  if (e.button !== 0) return;
  const element = e.currentTarget as HTMLElement;
  const idPointeur = e.pointerId;
  const depart = { x: e.clientX, y: e.clientY };
  let commence = false;

  const bouger = (ev: PointerEvent) => {
    if (ev.pointerId !== idPointeur) return;
    if (!commence) {
      if (Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) < SEUIL_PX) return;
      commence = true;
      try {
        element.setPointerCapture(idPointeur); // la souris est "tenue" jusqu'au relachement
      } catch {
        /* element deja retire : les ecouteurs de la fenetre suffisent */
      }
      cacherInfobulle();
      document.body.classList.add("glisser-en-cours");
    }
    const cible = cibleSous(ev.clientX, ev.clientY, charge);
    publier({ charge, ...versScene(ev.clientX, ev.clientY), cible: cible?.accepte ? cible.id : null, refusee: Boolean(cible && !cible.accepte) });
  };

  const terminer = (ev: PointerEvent | null, deposer: boolean) => {
    if (ev && ev.pointerId !== idPointeur) return;
    window.removeEventListener("dragstart", bloquerGlisserNatif, true);
    window.removeEventListener("pointermove", bouger);
    window.removeEventListener("pointerup", relacher);
    window.removeEventListener("pointercancel", annulerPointeur);
    window.removeEventListener("blur", annuler);
    window.removeEventListener("keydown", echap, true);
    document.body.classList.remove("glisser-en-cours");
    publier(null);
    if (!commence) return; // c'etait un simple clic : on laisse faire onClick
    // Le clic qui suit un glisser ne doit rien declencher (ex. utiliser le raccourci).
    window.addEventListener("click", avalerClic, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", avalerClic, { capture: true }), 0);
    if (!deposer || !ev) return;
    const cible = cibleSous(ev.clientX, ev.clientY, charge);
    if (cible?.accepte) cibles.get(cible.id)!.deposer(charge);
    else if (!cible) surLacherDehors?.();
  };
  const relacher = (ev: PointerEvent) => terminer(ev, true);
  const annulerPointeur = (ev: PointerEvent) => terminer(ev, false);
  const annuler = () => terminer(null, false);
  const echap = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape" || !commence) return;
    ev.stopPropagation(); // Echap annule le glisser sans fermer les fenetres
    annuler();
  };

  window.addEventListener("dragstart", bloquerGlisserNatif, true);
  window.addEventListener("pointermove", bouger);
  window.addEventListener("pointerup", relacher);
  window.addEventListener("pointercancel", annulerPointeur);
  window.addEventListener("blur", annuler); // Alt+Tab en plein glisser
  window.addEventListener("keydown", echap, true);
}

function bloquerGlisserNatif(e: DragEvent) {
  e.preventDefault();
}

function avalerClic(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
}

/**
 * Declare une zone de depot. Renvoie les attributs a poser sur l'element et
 * son etat : "survolee" (un objet acceptable est au-dessus) et "possible"
 * (un glisser en cours pourrait s'y deposer : on l'indique discretement).
 */
export function useCible(id: string, cible: Cible) {
  cibles.set(id, cible); // toujours la version la plus recente (donnees a jour)
  useEffect(() => () => void cibles.delete(id), [id]);
  const courant = useSyncExternalStore(abonner, () => etat);
  return {
    proprietes: { "data-cible": id },
    survolee: courant?.cible === id,
    possible: Boolean(courant && cible.accepte(courant.charge)),
  };
}

/** L'icone qui suit la souris pendant un glisser (au-dessus de tout, transparente aux clics). */
export function CoucheGlisser() {
  const courant = useSyncExternalStore(abonner, () => etat);
  if (!courant) return null;
  const { image, rarete, quantite } = apparence(courant.charge);
  return (
    <div className={`fantome case${courant.refusee ? " fantome--refuse" : ""}`} data-rarete={rarete} style={{ left: courant.x, top: courant.y }}>
      <img src={image} alt="" />
      {quantite > 1 && <span className="case__quantite">{quantite}</span>}
    </div>
  );
}
