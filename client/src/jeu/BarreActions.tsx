import { exemplairesDuRaccourci, objetRaccourcissable, referenceObjet } from "@partage/equipement.js";
import { jeu, useJeu } from "@/core/jeu";
import { iconeObjet, urlIcone } from "@/core/medias";
import type { Objet, Personnage, Raccourci, SortConnu } from "@/core/types";
import { etatDuSort, InfobulleSort } from "@/jeu/Grimoire";
import { InfobulleObjet } from "@/jeu/Sacs";
import { preparerGlisser, useCible, type Charge } from "@/ui/glisser";
import { avecInfobulle } from "@/ui/InfoBulle";
import { OUTILS_MJ } from "@/jeu/OutilsBarreMJ";

export const RACCOURCIS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];

/** Le personnage dont on voit la barre : le sien (le MJ : celui qu'il a cible). */
const personnageDeLaBarre = () => jeu.personnageDesSacs();

/** Le sort du grimoire vise par un raccourci (meme recherche que le serveur). */
const sortDuRaccourci = (p: Personnage, raccourci: Raccourci): SortConnu | undefined =>
  p.grimoire.find((s) => s.source === raccourci.reference || s.id === raccourci.reference);

/**
 * Utiliser le raccourci n (clic, ou touche 1 a =) : boire la potion, attaquer
 * avec l'arme, lancer le sort. Une attaque ou un sort ouvre la fenetre de resolution.
 */
export function utiliserRaccourci(index: number) {
  // Le MJ, sur la page "outils" : la touche declenche l'outil (Bestiaire, Carte...).
  if (jeu.estMJ() && jeu.lire().pageBarreMJ === "outils") return OUTILS_MJ[index]?.action();
  const p = personnageDeLaBarre();
  const raccourci = p?.barreActions[index];
  if (!p || !raccourci || jeu.lire().jet) return; // un jet attend deja "Valider"
  if (raccourci.type === "sort") jeu.lancerSort(p.id, raccourci.reference);
  else if (raccourci.type === "attaque") jeu.attaquerMonstre(p.id, raccourci.reference);
  else jeu.utiliser(p.id, raccourci.reference);
}

function CaseRaccourci({ index, p, modifiable }: { index: number; p: Personnage | null; modifiable: boolean }) {
  const touche = RACCOURCIS[index];
  const raccourci = p?.barreActions[index] ?? null;
  // L'objet designe : dans le sac, ou porte. Plus aucun exemplaire : la case est grisee.
  const exemplaires = p && raccourci ? exemplairesDuRaccourci(p, raccourci.reference) : null;
  const estSort = raccourci?.type === "sort";
  const sort = p && raccourci && estSort ? sortDuRaccourci(p, raccourci) : undefined;
  const sortVerrouille = Boolean(p && sort && !etatDuSort(p, sort).debloque);
  // Attaque d'un monstre du bestiaire (barre du monstre, cote MJ).
  const estAttaque = raccourci?.type === "attaque";
  const attaque = p && estAttaque ? p.attaquesMonstre.find((a) => a.nom === raccourci!.reference) : undefined;
  const objet: Objet | undefined = estSort || estAttaque ? undefined : (exemplaires?.dansLeSac[0] ?? exemplaires?.equipes[0]?.[1]);
  const quantite = exemplaires ? exemplaires.dansLeSac.reduce((t, o) => t + o.quantite, 0) : 0;
  const image = sort ? iconeObjet(sort) : objet ? iconeObjet(objet) : raccourci ? urlIcone(raccourci.reference) : "";

  const depot = useCible(`barre:${index}`, {
    accepte: (c) =>
      modifiable &&
      Boolean(p) &&
      (c.origine === "barre" ||
        (c.origine === "grimoire" && c.idPersonnage === p!.id) ||
        ((c.origine === "sac" || c.origine === "equipement") && c.idPersonnage === p!.id && objetRaccourcissable(c.objet))),
    deposer: (c) => {
      if (!p) return;
      if (c.origine === "barre") {
        // Deux raccourcis echangent leur place.
        jeu.definirRaccourci(p.id, index, p.barreActions[c.index]);
        jeu.definirRaccourci(p.id, c.index, raccourci);
      } else if (c.origine === "grimoire") {
        jeu.definirRaccourci(p.id, index, { type: "sort", reference: c.sort.source ?? c.sort.id });
      } else if (c.origine === "sac" || c.origine === "equipement") {
        jeu.definirRaccourci(p.id, index, { type: "objet", reference: referenceObjet(c.objet) });
      }
    },
  });

  const glisser = (e: React.PointerEvent) => {
    if (!p || !raccourci || !modifiable) return;
    const charge: Charge = { origine: "barre", image, rarete: objet?.rarete, idPersonnage: p.id, index };
    // Lache hors de la barre : le raccourci disparait (comme dans WoW). L'objet (ou le sort), lui, reste.
    preparerGlisser(e, charge, () => jeu.definirRaccourci(p.id, index, null));
  };

  const indisponible = raccourci && (estAttaque ? !attaque : estSort ? !sort || sortVerrouille : !objet);
  const classes = ["case", raccourci && "case--deplacable", indisponible && "case--epuisee", depot.possible && "case--possible", depot.survolee && "case--survolee"];
  return (
    <div
      className={classes.filter(Boolean).join(" ")}
      data-rarete={objet?.rarete}
      {...depot.proprietes}
      onPointerDown={glisser}
      onClick={() => utiliserRaccourci(index)}
      {...avecInfobulle(() =>
        raccourci && estAttaque ? (
          <>
            <div className="infobulle__titre">{raccourci.reference}</div>
            {attaque && (
              <div>
                {attaque.toucher >= 0 ? "+" : ""}
                {attaque.toucher} au toucher - {attaque.degats} {attaque.type}
              </div>
            )}
            <div className="infobulle__ligne--vert">Clic ou touche {touche} : attaquer (fenetre de des).</div>
          </>
        ) : raccourci && estSort ? (
          <>
            {sort ? <InfobulleSort sort={sort} p={p} /> : <div className="infobulle__titre">Ce sort n'est plus dans le grimoire</div>}
            {sort && !sortVerrouille && <div className="infobulle__ligne--vert">Clic ou touche {touche} : lancer.</div>}
            <div className="infobulle__ligne--gris">Glisse-le hors de la barre pour retirer le raccourci.</div>
          </>
        ) : raccourci ? (
          <>
            {objet ? <InfobulleObjet objet={objet} /> : <div className="infobulle__titre">Plus aucun exemplaire</div>}
            <div className="infobulle__ligne--vert">Clic ou touche {touche} : {objet?.soins ? "utiliser" : "attaquer"}.</div>
            <div className="infobulle__ligne--gris">Glisse-le hors de la barre pour retirer le raccourci.</div>
          </>
        ) : (
          <>
            <div className="infobulle__titre">Emplacement {touche}</div>
            <div className="infobulle__ligne--gris">Vide. Glisse ici une arme, une potion (B) ou un sort du grimoire (P).</div>
          </>
        ),
      )}
    >
      {raccourci && (estAttaque ? <span className="case-outil-mj__symbole">⚔</span> : <img src={image} alt="" />)}
      {objet?.soins && <span className="case__quantite">{quantite}</span>}
      <span className="actions__raccourci">{touche}</span>
    </div>
  );
}

/** Une case de la barre du MJ : un outil (icone doree, nom en infobulle). */
function CaseOutilMJ({ index }: { index: number }) {
  const outil = OUTILS_MJ[index];
  const actif = useJeu((e) => Boolean(outil?.actif?.(e)));
  const touche = RACCOURCIS[index];
  if (!outil) return <div className="case case--vide-mj" />;
  return (
    <button
      type="button"
      className={`case case-outil-mj${actif ? " case-outil-mj--actif" : ""}`}
      onClick={outil.action}
      aria-label={outil.nom}
      {...avecInfobulle(() => (
        <>
          <div className="infobulle__titre">{outil.nom}</div>
          <div className="infobulle__ligne--or">{outil.aide}</div>
          <div className="infobulle__ligne--gris">Clic ou touche {touche}.</div>
        </>
      ))}
    >
      <span className="case-outil-mj__symbole">{outil.symbole}</span>
      <span className="actions__raccourci">{touche}</span>
    </button>
  );
}

/**
 * Bas centre : 12 raccourcis, encadres de deux griffons.
 * Chez le MJ, deux "pages" (comme les pages de barre de WoW) : 1 = ses outils,
 * 2 = la barre du personnage qu'il a cible (pour le faire agir).
 */
export function BarreActions() {
  const p = useJeu((e) => jeu.personnageDesSacs(e));
  const modifiable = useJeu((e) => Boolean(p && (e.profil?.role === "mj" || jeu.mesPersonnages(e).some((m) => m.id === p.id))));
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const page = useJeu((e) => e.pageBarreMJ);
  const outils = estMJ && page === "outils";
  const changerPage = () => jeu.modifier((e) => ({ pageBarreMJ: e.pageBarreMJ === "outils" ? "personnage" : "outils" }));
  return (
    <div className={`actions${estMJ ? " actions--pages" : ""}`}>
      <div className="actions__embleme actions__embleme--gauche" />
      <div className="actions__barre cadre">
        {RACCOURCIS.map((touche, index) =>
          outils ? <CaseOutilMJ key={touche} index={index} /> : <CaseRaccourci key={touche} index={index} p={p} modifiable={modifiable} />,
        )}
        {estMJ && (
          <div className="actions__page">
            <button type="button" onClick={changerPage} aria-label="Page precedente">
              ▲
            </button>
            <span
              {...avecInfobulle(() => (
                <>
                  <div className="infobulle__titre">{outils ? "Page 1 : outils du MJ" : `Page 2 : barre de ${p?.nom ?? "(aucune cible)"}`}</div>
                  <div className="infobulle__ligne--gris">Les fleches changent de page. Page 2 : cible d'abord un personnage (clic sur son cadre ou son pion).</div>
                </>
              ))}
            >
              {outils ? 1 : 2}
            </span>
            <button type="button" onClick={changerPage} aria-label="Page suivante">
              ▼
            </button>
          </div>
        )}
      </div>
      <div className="actions__embleme actions__embleme--droite" />
    </div>
  );
}
