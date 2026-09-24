import { useState } from "react";
import { CLASSES } from "@partage/dnd5e.js";
import { MODELES_RESSOURCES } from "@partage/ressources.js";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone, urlPortrait } from "@/core/medias";
import type { Personnage, Ressource } from "@/core/types";
import { Barre } from "@/ui/Barre";
import { avecInfobulle } from "@/ui/InfoBulle";

const APPARENCES_CONNUES = new Set([...Object.keys(MODELES_RESSOURCES)]);

/** La ressource affichee sous la vie : une jauge WoW en priorite (Mana, Rage...). */
function ressourcePrincipale(p: Personnage): Ressource | null {
  return p.ressources.find((r) => r.type === "jauge") ?? p.ressources[0] ?? null;
}

function couleurRessource(r: Ressource) {
  return APPARENCES_CONNUES.has(r.apparence) ? `var(--ressource-${r.apparence})` : "var(--ressource-autre)";
}

function Portrait({ nom, niveau }: { nom: string; niveau: number }) {
  const [absent, setAbsent] = useState(false);
  const initiales = nom
    .split(/\s+/)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="portrait">
      <div className="portrait__initiales">{initiales}</div>
      {/* Ton image portraits/<nom>.png si elle existe ; sinon les initiales. */}
      {!absent && (
        <img src={`${urlPortrait(nom)}?remplacement=non`} alt="" onError={() => setAbsent(true)} style={{ position: "relative" }} />
      )}
      <div className="portrait__niveau">{niveau}</div>
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
            Niveau {p.niveau} {(CLASSES as Record<string, { nom: string }>)[p.classe]?.nom}
          </div>
          <div className="infobulle__ligne--gris">
            Joueur : {p.proprietaire}
            {enLigne ? "" : " (hors ligne)"}
          </div>
          <div>
            PV {pv.actuels}/{pv.max}
            {pv.temporaires ? ` (+${pv.temporaires})` : ""} - CA {p.classeArmure}
          </div>
        </>
      ))}
    >
      <Portrait nom={p.nom} niveau={p.niveau} />
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
          <div className="cadre-unite__etats">
            {p.etats.map((etat) => (
              <img
                key={etat.id}
                className={`etat--${etat.nature}`}
                src={urlIcone(etat.icone)}
                alt={etat.nom}
                {...avecInfobulle(() => (
                  <>
                    <div className={etat.nature === "buff" ? "infobulle__ligne--vert" : "infobulle__ligne--or"}>{etat.nom}</div>
                    <div>{etat.description}</div>
                    {etat.roundsRestants && <div className="infobulle__ligne--gris">{etat.roundsRestants} round(s)</div>}
                  </>
                ))}
              />
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
