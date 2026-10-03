import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone, urlPortrait } from "@/core/medias";
import { rolePortrait, useTexture, useTextures } from "@/core/textures";
import type { Personnage, Ressource } from "@/core/types";
import { Barre } from "@/ui/Barre";
import { avecInfobulle, versScene } from "@/ui/InfoBulle";

// Couleurs de barre prevues par theme.css (fiches d'avant le referentiel).
const APPARENCES_DU_THEME = new Set(["mana", "rage", "energie", "focalisation", "puissance-runique", "eclats-ame", "points-combo", "puissance-sacree"]);

/** La ressource affichee sous la vie : une jauge WoW en priorite (Mana, Rage...). */
export function ressourcePrincipale(p: Personnage): Ressource | null {
  return p.ressources.find((r) => r.type === "jauge") ?? p.ressources[0] ?? null;
}

/** Couleur de la barre : celle du referentiel (ressources.json), sinon celle du theme. */
export function couleurRessource(r: Ressource) {
  const modele = jeu.lire().referentiel?.ressources.find((m) => m.id === r.apparence || m.id === r.cle);
  if (modele?.couleur) return modele.couleur;
  return APPARENCES_DU_THEME.has(r.apparence) ? `var(--ressource-${r.apparence})` : "var(--ressource-autre)";
}

function Portrait({ nom, niveau, fichier, repose, parDefaut }: { nom: string; niveau: number; fichier: string | null; repose: boolean; parDefaut: string | null }) {
  const [absent, setAbsent] = useState(false);
  const initiales = nom
    .split(/\s+/)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    // "Repose" (apres un repos long) : le portrait luit doucement et le niveau
    // laisse la place a "Zzz", comme l'etat "Reposé" de WoW.
    <div className={`portrait${repose ? " portrait--repose" : ""}`}>
      <div className="portrait__initiales">{initiales}</div>
      {/* Ton image portraits/<nom>.png si elle existe ; sinon les initiales. */}
      {!absent && (
        <img
          src={`${fichier ? `/medias/portraits/${encodeURIComponent(fichier)}` : urlPortrait(nom)}?remplacement=non`}
          alt=""
          onError={() => setAbsent(true)}
          style={{ position: "relative" }}
        />
      )}
      {/* Sinon : le portrait provisoire de WoW pour sa race et son sexe (dossier interface/). */}
      {absent && parDefaut && <img src={parDefaut} alt="" style={{ position: "relative" }} />}
      <div className="portrait__niveau">{repose ? <span className="portrait__zzz">Zzz</span> : niveau}</div>
    </div>
  );
}

// Comme dans WoW : au-dela d'un groupe de 5, on passe en "raid" (cadres compacts).
const SEUIL_RAID = 6;
const TAILLE_GROUPE_RAID = 5;

/** Ce que tous les cadres d'un heros partagent : clic (cibler), clic droit (MJ), infobulle. */
function proprietesCadre(p: Personnage, enLigne: boolean) {
  const pv = p.pointsDeVie;
  return {
    // Clic : ce personnage devient la "cible" (ses sacs / sa fiche s'ouvrent avec B / C).
    onClick: () => jeu.modifier((e) => (e.selection === p.id ? { selection: null, cible: null } : { selection: p.id, cible: p.id })),
    // Clic droit (MJ) : le menu contextuel (PV, alterations, expulser...).
    onContextMenu: (e: React.MouseEvent) => {
      if (!jeu.estMJ()) return;
      e.preventDefault();
      jeu.modifier({ menu: { idPersonnage: p.id, ...versScene(e.clientX, e.clientY) } });
    },
    ...avecInfobulle(() => (
      <>
        <div className="infobulle__titre infobulle__ligne--or">{p.nom}</div>
        <div>
          Niveau {p.niveau} {jeu.nomRace(p.race)} {jeu.nomClasse(p.classe)}
        </div>
        <div className="infobulle__ligne--gris">
          Joueur : {p.proprietaire}
          {enLigne ? "" : " (hors ligne)"}
        </div>
        <div>
          PV {pv.actuels}/{pv.max}
          {pv.temporaires ? ` (+${pv.temporaires})` : ""} - CA {p.classeArmure}
        </div>
        {p.repose && <div className="infobulle__ligne--bleu">Repose : il a profite d'un repos long et n'a pas encore combattu.</div>}
      </>
    )),
  };
}

/**
 * Cadre de raid (6 heros et plus) : un rectangle compact facon WoW. La vie
 * remplit le cadre a la couleur de la classe ; la ressource en fin liseré en
 * bas ; nom au centre. Grise si le joueur est hors ligne ou le heros a 0 PV.
 */
function CadreRaid({ p, enLigne, choisi }: { p: Personnage; enLigne: boolean; choisi: boolean }) {
  const couleurClasse = useJeu((e) => e.referentiel?.classes.find((c) => c.id === p.classe)?.couleur ?? null);
  const pv = p.pointsDeVie;
  const ressource = ressourcePrincipale(p);
  const aTerre = pv.actuels <= 0;
  const classes = ["cadre-raid", !enLigne && "cadre-raid--hors-ligne", aTerre && "cadre-raid--a-terre", choisi && "cadre-raid--selection"].filter(Boolean);
  const debuffs = p.etats.filter((e) => e.nature === "debuff").slice(0, 3);
  return (
    <div className={classes.join(" ")} {...proprietesCadre(p, enLigne)}>
      <div
        className="cadre-raid__vie"
        style={{ width: `${Math.max(0, Math.min(100, (pv.actuels / pv.max) * 100))}%`, background: couleurClasse ?? undefined }}
      />
      {ressource && (
        <div className="cadre-raid__ressource">
          <div style={{ width: `${(ressource.actuel / Math.max(1, ressource.max)) * 100}%`, background: couleurRessource(ressource) }} />
        </div>
      )}
      <span className="cadre-raid__nom">{p.nom}</span>
      <span className="cadre-raid__etat">{!enLigne ? "Hors ligne" : aTerre ? "Inconscient" : `${pv.actuels} / ${pv.max}`}</span>
      {debuffs.length > 0 && (
        <span className="cadre-raid__auras">
          {debuffs.map((etat) => (
            <img key={etat.id} src={urlIcone(etat.icone)} alt={etat.nom} />
          ))}
        </span>
      )}
    </div>
  );
}

function CadreUnite({ p, principal, enLigne, choisi }: { p: Personnage; principal: boolean; enLigne: boolean; choisi: boolean }) {
  const pv = p.pointsDeVie;
  const ressource = ressourcePrincipale(p);
  // UI-Player-Portrait dans le dossier interface/ : le cadre de WoW remplace le cadre dessine.
  const texture = useTexture("cadre-unite");
  const parDefaut = useTextures()[rolePortrait(p.race, p.sexe) ?? "fond-"] ?? null;
  const classes = [
    "cadre-unite",
    texture ? "cadre-unite--texture" : "cadre",
    principal && "cadre-unite--joueur",
    !enLigne && "cadre-unite--hors-ligne",
    choisi && "cadre-unite--selection",
  ].filter(Boolean);

  return (
    <div className={classes.join(" ")} {...proprietesCadre(p, enLigne)}>
      <Portrait nom={p.nom} niveau={p.niveau} fichier={p.portrait} repose={p.repose} parDefaut={parDefaut} />
      <div className="cadre-unite__infos">
        <div className="plaque-nom">
          <span className="plaque-nom__nom">{p.nom}</span>
          <span className="plaque-nom__detail">{enLigne ? p.proprietaire : "Hors ligne"}</span>
        </div>
        <Barre
          classe="barre--vie"
          actuel={pv.actuels}
          max={pv.max}
          texte={`${pv.actuels} / ${pv.max}${pv.temporaires ? ` (+${pv.temporaires})` : ""}`}
        />
        {ressource && (
          <Barre
            classe="barre--ressource"
            actuel={ressource.actuel}
            max={ressource.max}
            couleur={couleurRessource(ressource)}
            texte={`${ressource.nom} ${ressource.actuel} / ${ressource.max}`}
          />
        )}
        {p.etats.length > 0 && (
          // Les auras, facon WoW : de petites icones carrees sous le nom. Liseré
          // sombre pour un buff, rouge pour un debuff ; les rounds restants en bas.
          // Elles arrivent en direct : le serveur renvoie la fiche a chaque changement.
          <div className="auras">
            {[...p.etats]
              .sort((a, b) => Number(a.nature === "debuff") - Number(b.nature === "debuff"))
              .map((etat) => (
                <span
                  key={etat.id}
                  className={`aura aura--${etat.nature}`}
                  {...avecInfobulle(() => (
                    <>
                      <div className={`infobulle__titre ${etat.nature === "buff" ? "infobulle__ligne--vert" : "infobulle__ligne--rouge"}`}>{etat.nom}</div>
                      <div className="infobulle__ligne--gris">{etat.nature === "buff" ? "Effet benefique" : "Effet nefaste"}</div>
                      {etat.description && <div>{etat.description}</div>}
                      {etat.roundsRestants !== null && <div className="infobulle__ligne--or">Encore {etat.roundsRestants} round(s)</div>}
                    </>
                  ))}
                >
                  <img src={urlIcone(etat.icone)} alt={etat.nom} />
                  {etat.roundsRestants !== null && <span className="aura__duree">{etat.roundsRestants}</span>}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Haut gauche : mon personnage d'abord (grand cadre), puis le reste du groupe. */
export function CadresGroupe() {
  const personnages = useJeu((e) => e.personnages);
  const presence = useJeu((e) => e.presence);
  const profil = useJeu((e) => e.profil);
  const selection = useJeu((e) => e.selection);
  const refColonne = useRef<HTMLDivElement>(null);
  const refListe = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(1);

  // Les cadres rapetissent s'ils ne tiennent pas dans la hauteur libre (au-dessus
  // de la discussion) : 6 heros sur un ecran de portable, par exemple.
  useLayoutEffect(() => {
    const colonne = refColonne.current;
    const liste = refListe.current;
    if (!colonne || !liste) return;
    const ajuster = () => {
      const besoin = liste.offsetHeight; // hauteur naturelle (le scale n'y change rien)
      setEchelle(besoin > 0 ? Math.min(1, colonne.clientHeight / besoin) : 1);
    };
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(colonne);
    observateur.observe(liste);
    return () => observateur.disconnect();
  }, []);

  const moi = profil?.pseudo.toLocaleLowerCase("fr");
  const enLigne = new Set(presence.map((c) => c.pseudo.toLocaleLowerCase("fr")));
  // Les PNJ n'apparaissent jamais dans le groupe.
  const groupe = Object.values(personnages)
    .filter((p) => p.proprietaire !== null)
    .sort((a, b) => Number(b.proprietaire?.toLocaleLowerCase("fr") === moi) - Number(a.proprietaire?.toLocaleLowerCase("fr") === moi));
  const principal = groupe[0]?.proprietaire?.toLocaleLowerCase("fr") === moi ? groupe[0] : null;
  const autres = principal ? groupe.slice(1) : groupe;
  const raid = groupe.length >= SEUIL_RAID;
  const estEnLigne = (p: Personnage) => enLigne.has(p.proprietaire!.toLocaleLowerCase("fr"));

  return (
    <div className="groupe" ref={refColonne}>
      <div className="groupe__liste" ref={refListe} style={echelle < 1 ? ({ "--echelle-groupe": echelle } as CSSProperties) : undefined}>
        {/* Mon personnage garde son grand cadre (comme le cadre du joueur de WoW). */}
        {principal && <CadreUnite p={principal} principal enLigne={estEnLigne(principal)} choisi={selection === principal.id} />}
        {raid ? (
          // Raid : des colonnes de 5 cadres compacts ("Groupe 1", "Groupe 2"...).
          <div className="raid-groupes">
            {Array.from({ length: Math.ceil(autres.length / TAILLE_GROUPE_RAID) }, (_, i) => (
              <div key={i} className="raid-groupes__colonne">
                <div className="raid-groupes__titre">Groupe {i + 1}</div>
                {autres.slice(i * TAILLE_GROUPE_RAID, (i + 1) * TAILLE_GROUPE_RAID).map((p) => (
                  <CadreRaid key={p.id} p={p} enLigne={estEnLigne(p)} choisi={selection === p.id} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          autres.map((p) => <CadreUnite key={p.id} p={p} principal={false} enLigne={estEnLigne(p)} choisi={selection === p.id} />)
        )}
      </div>
    </div>
  );
}
