import { useState } from "react";
import { attaquesEquipees, referenceObjet } from "@partage/equipement.js";
import { emplacementsDuPersonnage, niveauDeSortMax, resolutionDuSort, statistiquesIncantation } from "@partage/magie.js";
import { NOMS_CARACTERISTIQUES } from "@partage/creation.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import { signe } from "@/core/journal";
import { iconeObjet } from "@/core/medias";
import type { Objet, Personnage, SortConnu } from "@/core/types";
import { etatDuSort, InfobulleSort } from "@/jeu/Grimoire";
import { Fenetre } from "@/ui/Fenetre";
import { preparerGlisser, useCible } from "@/ui/glisser";
import { avecInfobulle } from "@/ui/InfoBulle";

const nomCarac = (cle: string) => (NOMS_CARACTERISTIQUES as Record<string, string>)[cle] ?? cle;
const referenceDuSort = (sort: SortConnu) => sort.source ?? sort.id; // ce que retient la barre d'actions
type Onglet = "armes" | number; // number : niveau de sort (0 = sorts mineurs)

/** La portee d'une arme : ecrite dans ses proprietes ("Munitions (portee 24/96 m)"), sinon deduite. */
function porteeArme(objet: Objet, emplacement: string) {
  const ecrite = objet.arme?.proprietes.find((p) => /port[ée]e/i.test(p));
  if (ecrite) return ecrite.match(/\(([^)]+)\)/)?.[1] ?? ecrite;
  if (objet.arme?.proprietes.some((p) => /allonge/i.test(p))) return "Allonge (3 m)";
  return emplacement === "distance" ? "A distance" : "Corps a corps (1,5 m)";
}

/** Les gemmes d'emplacements d'un niveau : allumees (disponibles) puis eteintes. */
export function Gemmes({ actuel, max, choisi, surClic }: { actuel: number; max: number; choisi?: boolean; surClic?: () => void }) {
  return (
    <span className={`gemmes${choisi ? " gemmes--choisies" : ""}${surClic ? " gemmes--cliquables" : ""}`} onClick={surClic}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`gemme${i < actuel ? " gemme--allumee" : ""}`} />
      ))}
    </span>
  );
}

/** Une ligne d'action facon D&D Beyond : icone, nom, portee, effet ; un clic la deplie (regle complete). */
function Ligne({
  icone,
  glisser,
  nom,
  etiquettes,
  portee,
  effet,
  verrou,
  ouverte,
  surBascule,
  infobulle,
  children,
}: {
  icone: string;
  glisser?: (e: React.PointerEvent) => void;
  nom: string;
  etiquettes?: string[];
  portee: string;
  effet: string;
  verrou?: string | null;
  ouverte: boolean;
  surBascule: () => void;
  infobulle?: () => React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`action${ouverte ? " action--ouverte" : ""}${verrou ? " action--verrouillee" : ""}`}>
      <div className="action__entete" onClick={surBascule} role="button" aria-expanded={ouverte}>
        <span
          className={`case action__icone${glisser ? " case--deplacable" : ""}`}
          onPointerDown={glisser}
          onClick={(e) => e.stopPropagation()}
          {...(infobulle ? avecInfobulle(infobulle) : {})}
        >
          <img src={icone} alt="" />
        </span>
        <span className="action__nom">
          {nom}
          {etiquettes?.map((t) => (
            <small key={t} className="action__etiquette" title={t === "C" ? "Concentration" : "Rituel"}>
              {t}
            </small>
          ))}
          {verrou && <small className="action__verrou">{verrou}</small>}
        </span>
        <span className="action__portee">{portee}</span>
        <span className="action__effet">{effet}</span>
        <span className="action__chevron" aria-hidden="true">
          {ouverte ? "▴" : "▾"}
        </span>
      </div>
      {ouverte && <div className="action__detail">{children}</div>}
    </div>
  );
}

/**
 * La fenetre "Actions & Sorts" (touche P), facon D&D Beyond dans un cadre WoW :
 * des onglets (Armes, Sorts mineurs, Niveau 1...), une ligne par action
 * (icone, nom, portee, effet) qui se deplie pour lire la regle complete, et le
 * bouton qui ouvre la modale d'incantation (niveau d'emplacement, avantage).
 * Les armes viennent de l'EQUIPEMENT porte ; les sorts, du grimoire.
 * L'icone se glisse sur la barre d'actions. Le MJ y depose des sorts du
 * compendium pour les apprendre au personnage.
 */
export function ActionsSorts({ position }: { position: { x: number; y: number } }) {
  const p = useJeu((e) => jeu.personnageDesSacs(e));
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const modifiable = useJeu((e) => Boolean(p && (e.profil?.role === "mj" || jeu.mesPersonnages(e).some((m) => m.id === p.id))));
  const [onglet, setOnglet] = useState<Onglet | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, grimoire: false } }));
  // MJ : lacher un sort du compendium ici l'apprend au personnage.
  const depot = useCible(`actions-sorts`, {
    accepte: (c) => estMJ && Boolean(p) && c.origine === "compendium-sort",
    deposer: (c) => c.origine === "compendium-sort" && p && jeu.demander(EVENEMENTS.GRIMOIRE_APPRENDRE, { idPersonnage: p.id, idSort: c.sort.id }),
  });

  if (!p) {
    return (
      <Fenetre titre="Actions & Sorts" classe="grimoire actions-sorts" positionInitiale={position} surFermer={fermer}>
        <p className="grimoire__vide">Aucun personnage.</p>
      </Fenetre>
    );
  }

  const classe = jeu.classeDe(p);
  const stats = statistiquesIncantation(p, classe);
  const maximum = niveauDeSortMax(p.niveau, classe?.progressionSorts);
  const emplacements = emplacementsDuPersonnage(p, classe);
  const armes = attaquesEquipees(p);
  const sorts = [...p.grimoire].sort((a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom, "fr"));
  const niveaux = [...new Set(sorts.map((s) => s.niveau))];
  const onglets: Onglet[] = ["armes", ...niveaux];
  const actif: Onglet = onglet !== null && onglets.includes(onglet) ? onglet : niveaux.length ? niveaux[0] : "armes";
  const basculer = (cle: string) => setOuverte((avant) => (avant === cle ? null : cle));

  return (
    <Fenetre titre={`Actions & Sorts - ${p.nom}`} classe="grimoire actions-sorts" positionInitiale={position} surFermer={fermer}>
      <div className={`actions-sorts__corps${depot.possible ? " zone--possible" : ""}${depot.survolee ? " zone--survolee" : ""}`} {...depot.proprietes}>
        <div className="actions-sorts__bandeau">
          <span>{nomCarac(stats.caracteristique)}</span>
          <span>Attaque de sort {signe(stats.attaque)}</span>
          <span>DD {stats.dd}</span>
          <span>{maximum === 0 ? "Sorts mineurs seulement" : `Sorts jusqu'au niveau ${maximum}`}</span>
          <button type="button" className="grimoire__signet" onClick={() => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, carnet: true } }))}>
            Carnet (N)
          </button>
        </div>
        {emplacements.length > 0 && (
          <div className="actions-sorts__emplacements" {...avecInfobulle(() => <div>Emplacements de sorts : une gemme s'eteint a chaque sort lance. Le repos long les rallume.</div>)}>
            {emplacements.map((e) => (
              <span key={e.niveau} className="actions-sorts__emplacement">
                Niv {e.niveau} <Gemmes actuel={e.actuel} max={e.max} />
              </span>
            ))}
          </div>
        )}
        <div className="actions-sorts__onglets" role="tablist">
          {onglets.map((o) => (
            <button key={String(o)} type="button" role="tab" aria-selected={actif === o} className={`onglet${actif === o ? " onglet--actif" : ""}`} onClick={() => setOnglet(o)}>
              {o === "armes" ? "Armes" : o === 0 ? "Mineurs" : `Niv ${o}`}
            </button>
          ))}
        </div>

        <div className="actions-sorts__liste">
          {actif === "armes" && armes.length === 0 && <p className="grimoire__vide">Aucune arme equipee. Equipe-en une depuis ta fiche (C) ou ton sac (B).</p>}
          {actif === "armes" &&
            armes.map((a) => {
              const objet = p.equipement[a.emplacement as keyof typeof p.equipement] as Objet;
              const cle = `arme:${a.idObjet}`;
              return (
                <Ligne
                  key={cle}
                  icone={iconeObjet(objet)}
                  glisser={modifiable ? (e) => preparerGlisser(e, { origine: "equipement", objet, idPersonnage: p.id, emplacement: a.emplacement }) : undefined}
                  nom={objet.nom}
                  portee={porteeArme(objet, a.emplacement)}
                  effet={`${signe(a.bonus)} | ${a.degats} ${a.typeDegats}`}
                  ouverte={ouverte === cle}
                  surBascule={() => basculer(cle)}
                >
                  <dl className="action__regles">
                    <dt>Toucher</dt>
                    <dd>
                      {signe(a.bonus)} (Maitrise + {nomCarac(a.caracteristique)})
                    </dd>
                    <dt>Degats</dt>
                    <dd>
                      {a.degats} {a.typeDegats}
                    </dd>
                    {objet.arme?.proprietes.length ? (
                      <>
                        <dt>Proprietes</dt>
                        <dd>{objet.arme.proprietes.join(", ")}</dd>
                      </>
                    ) : null}
                  </dl>
                  {objet.description && <p className="action__description">{objet.description}</p>}
                  {modifiable && (
                    <button type="button" className="bouton action__lancer" onClick={() => jeu.preparerAction(p.id, "arme", referenceObjet(objet))}>
                      Attaquer...
                    </button>
                  )}
                </Ligne>
              );
            })}
          {actif !== "armes" &&
            sorts
              .filter((s) => s.niveau === actif)
              .map((sort) => {
                const { debloque, requis } = etatDuSort(p, sort);
                const resolution = resolutionDuSort(sort);
                const cle = `sort:${sort.id}`;
                const effet = sort.degats ? `${sort.degats.formule} ${sort.degats.type}` : sort.soins ? `Soins ${sort.soins}` : sort.duree;
                return (
                  <Ligne
                    key={cle}
                    icone={iconeObjet(sort)}
                    glisser={modifiable ? (e) => preparerGlisser(e, { origine: "grimoire", sort, idPersonnage: p.id }) : undefined}
                    nom={sort.nom}
                    etiquettes={[sort.concentration && "C", sort.rituel && "R"].filter((t): t is string => Boolean(t))}
                    portee={sort.portee || "-"}
                    effet={effet}
                    verrou={debloque ? null : `niveau ${requis ?? "?"}`}
                    ouverte={ouverte === cle}
                    surBascule={() => basculer(cle)}
                    infobulle={() => <InfobulleSort sort={sort} p={p} />}
                  >
                    <dl className="action__regles">
                      <dt>Incantation</dt>
                      <dd>{sort.incantation}</dd>
                      <dt>Portee</dt>
                      <dd>{sort.portee || "-"}</dd>
                      <dt>Composantes</dt>
                      <dd>{sort.composantes || "-"}</dd>
                      <dt>Duree</dt>
                      <dd>
                        {sort.duree}
                        {sort.concentration ? " (concentration)" : ""}
                      </dd>
                      <dt>Resolution</dt>
                      <dd>
                        {resolution === "attaque"
                          ? `Jet d'attaque de sort (${signe(stats.attaque)})`
                          : resolution === "sauvegarde"
                            ? `Sauvegarde${sort.sauvegarde ? ` de ${nomCarac(sort.sauvegarde)}` : ""} contre DD ${stats.dd}`
                            : "Automatique"}
                      </dd>
                      {sort.degats && (
                        <>
                          <dt>Degats</dt>
                          <dd>
                            {sort.degats.formule} {sort.degats.type}
                          </dd>
                        </>
                      )}
                      {sort.soins && (
                        <>
                          <dt>Soins</dt>
                          <dd>
                            {sort.soins} + {nomCarac(stats.caracteristique)}
                          </dd>
                        </>
                      )}
                      {sort.parNiveauSuperieur && sort.niveau > 0 && (
                        <>
                          <dt>Niveaux superieurs</dt>
                          <dd>+{sort.parNiveauSuperieur} par niveau d'emplacement au-dessus du {sort.niveau}</dd>
                        </>
                      )}
                    </dl>
                    {sort.description && <p className="action__description">{sort.description}</p>}
                    <div className="action__boutons">
                      {modifiable && (
                        <button type="button" className="bouton action__lancer" disabled={!debloque} onClick={() => jeu.preparerAction(p.id, "sort", referenceDuSort(sort))}>
                          {debloque ? "Lancer..." : `Debloque au niveau ${requis ?? "?"}`}
                        </button>
                      )}
                      {estMJ && (
                        <button type="button" className="bouton bouton--discret" onClick={() => jeu.demander(EVENEMENTS.GRIMOIRE_OUBLIER, { idPersonnage: p.id, idSort: sort.id })}>
                          Oublier (MJ)
                        </button>
                      )}
                    </div>
                  </Ligne>
                );
              })}
          {actif !== "armes" && sorts.length === 0 && <p className="grimoire__vide">Aucun sort connu. Le MJ t'enseigne de nouveaux sorts au fil de l'aventure.</p>}
        </div>
      </div>
    </Fenetre>
  );
}
