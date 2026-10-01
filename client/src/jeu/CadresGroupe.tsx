import { useState } from "react";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone, urlPortrait } from "@/core/medias";
import type { Personnage, Ressource } from "@/core/types";
import { Barre } from "@/ui/Barre";
import { avecInfobulle } from "@/ui/InfoBulle";

// Couleurs de barre prevues par theme.css (fiches d'avant le referentiel).
const APPARENCES_DU_THEME = new Set(["mana", "rage", "energie", "focalisation", "puissance-runique", "eclats-ame", "points-combo", "puissance-sacree"]);

/** La ressource affichee sous la vie : une jauge WoW en priorite (Mana, Rage...). */
function ressourcePrincipale(p: Personnage): Ressource | null {
  return p.ressources.find((r) => r.type === "jauge") ?? p.ressources[0] ?? null;
}

/** Couleur de la barre : celle du referentiel (ressources.json), sinon celle du theme. */
function couleurRessource(r: Ressource) {
  const modele = jeu.lire().referentiel?.ressources.find((m) => m.id === r.apparence || m.id === r.cle);
  if (modele?.couleur) return modele.couleur;
  return APPARENCES_DU_THEME.has(r.apparence) ? `var(--ressource-${r.apparence})` : "var(--ressource-autre)";
}

function Portrait({ nom, niveau, fichier, repose }: { nom: string; niveau: number; fichier: string | null; repose: boolean }) {
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
      <div className="portrait__niveau">{repose ? <span className="portrait__zzz">Zzz</span> : niveau}</div>
    </div>
  );
}

function CadreUnite({ p, principal, enLigne, choisi }: { p: Personnage; principal: boolean; enLigne: boolean; choisi: boolean }) {
  const pv = p.pointsDeVie;
  const ressource = ressourcePrincipale(p);
  const classes = [
    "cadre-unite",
    "cadre",
    principal && "cadre-unite--joueur",
    !enLigne && "cadre-unite--hors-ligne",
    choisi && "cadre-unite--selection",
  ].filter(Boolean);

  return (
    <div
      className={classes.join(" ")}
      // Clic : ce personnage devient la "cible" (ses sacs / sa fiche s'ouvrent avec B / C).
      onClick={() => jeu.modifier((e) => ({ selection: e.selection === p.id ? null : p.id }))}
      {...avecInfobulle(() => (
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
      ))}
    >
      <Portrait nom={p.nom} niveau={p.niveau} fichier={p.portrait} repose={p.repose} />
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

  const moi = profil?.pseudo.toLocaleLowerCase("fr");
  const enLigne = new Set(presence.map((c) => c.pseudo.toLocaleLowerCase("fr")));
  // Les PNJ n'apparaissent jamais dans le groupe.
  const groupe = Object.values(personnages)
    .filter((p) => p.proprietaire !== null)
    .sort((a, b) => Number(b.proprietaire?.toLocaleLowerCase("fr") === moi) - Number(a.proprietaire?.toLocaleLowerCase("fr") === moi));

  return (
    <div className="groupe">
      {groupe.map((p, index) => (
        <CadreUnite
          key={p.id}
          p={p}
          principal={index === 0 && p.proprietaire?.toLocaleLowerCase("fr") === moi}
          enLigne={enLigne.has(p.proprietaire!.toLocaleLowerCase("fr"))}
          choisi={selection === p.id}
        />
      ))}
    </div>
  );
}
