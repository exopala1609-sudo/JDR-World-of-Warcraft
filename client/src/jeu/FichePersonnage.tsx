import { CARACTERISTIQUES } from "@partage/dnd5e.js";
import { EMPLACEMENTS, peutAllerDans } from "@partage/equipement.js";
import { signe } from "@/core/journal";
import { jeu, useJeu } from "@/core/jeu";
import { iconeObjet, urlIcone, urlPortrait } from "@/core/medias";
import type { Personnage } from "@/core/types";
import { InfobulleObjet } from "@/jeu/Sacs";
import { Fenetre } from "@/ui/Fenetre";
import { preparerGlisser, useCible } from "@/ui/glisser";
import { avecInfobulle } from "@/ui/InfoBulle";

// Les emplacements d'equipement, disposes comme dans WoW (identifiants de shared/equipement.js).
const COLONNE_GAUCHE = ["tete", "cou", "epaules", "dos", "torse", "chemise", "tabard", "poignets"];
const COLONNE_DROITE = ["mains", "taille", "jambes", "pieds", "doigt-1", "doigt-2", "bijou-1", "bijou-2"];
const ARMES = ["main-droite", "main-gauche", "distance"];

const NOMS_CARACS: Record<string, string> = {
  force: "Force",
  dexterite: "Dexterite",
  constitution: "Constitution",
  intelligence: "Intelligence",
  sagesse: "Sagesse",
  charisme: "Charisme",
};

/**
 * Un emplacement du mannequin. Pendant qu'on glisse un objet du sac, les
 * emplacements qui peuvent le recevoir s'illuminent (vert), celui survole
 * brille d'or. L'objet porte se glisse vers le sac ; clic droit = le ranger.
 */
function Emplacement({ id, p, modifiable }: { id: string; p: Personnage; modifiable: boolean }) {
  const nom = EMPLACEMENTS[id as keyof typeof EMPLACEMENTS];
  const objet = p.equipement[id];
  const depot = useCible(`emplacement:${p.id}:${id}`, {
    accepte: (c) => modifiable && c.origine === "sac" && c.idPersonnage === p.id && peutAllerDans(c.objet, id),
    deposer: (c) => c.origine === "sac" && jeu.equiper(p.id, c.objet.id, id),
  });
  const classes = ["case", objet ? "case--deplacable" : "case--vide", depot.possible && "case--possible", depot.survolee && "case--survolee"];
  return (
    <div
      className={classes.filter(Boolean).join(" ")}
      data-rarete={objet?.rarete}
      {...depot.proprietes}
      onPointerDown={objet && modifiable ? (e) => preparerGlisser(e, { origine: "equipement", objet, idPersonnage: p.id, emplacement: id }) : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        if (objet && modifiable) jeu.desequiper(p.id, id);
      }}
      {...avecInfobulle(() =>
        objet ? (
          <>
            <InfobulleObjet objet={objet} />
            {modifiable && <div className="infobulle__ligne--vert">Clic droit, ou glisse-le vers le sac : le ranger.</div>}
          </>
        ) : (
          <>
            <div className="infobulle__titre">{nom}</div>
            <div className="infobulle__ligne--gris">{modifiable ? "Vide. Glisse ici un objet de ton sac (B)." : "Vide."}</div>
          </>
        ),
      )}
    >
      {objet ? <img src={iconeObjet(objet)} alt={objet.nom} /> : <span className="case__libelle">{nom}</span>}
    </div>
  );
}

function Stat({ nom, valeur, variation }: { nom: string; valeur: string | number; variation?: number }) {
  const classe = variation === undefined ? "" : variation > 0 ? " stat__valeur--bonus" : variation < 0 ? " stat__valeur--malus" : "";
  return (
    <div className="stat">
      <span>{nom}</span>
      <span className={`stat__valeur${classe}`}>{valeur}</span>
    </div>
  );
}

export function FichePersonnage({ position }: { position: { x: number; y: number } }) {
  const p = useJeu((e) => jeu.personnageActif(e));
  // On equipe son propre personnage (le MJ : n'importe lequel). Les autres, on les "inspecte".
  const modifiable = useJeu((e) => Boolean(p && (e.profil?.role === "mj" || jeu.mesPersonnages(e).some((m) => m.id === p.id))));
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, personnage: false } }));

  if (!p) {
    return (
      <Fenetre titre="Personnage" classe="fiche" positionInitiale={position} surFermer={fermer}>
        <p className="fiche__sous-titre">Aucun personnage.</p>
      </Fenetre>
    );
  }

  const m = p.derives.modificateurs;
  const pv = p.pointsDeVie;
  return (
    <Fenetre titre={p.nom} classe="fiche" positionInitiale={position} surFermer={fermer}>
      <p className="fiche__sous-titre">
        Niveau {p.niveau} {jeu.nomRace(p.race)} {jeu.nomClasse(p.classe)}
        {p.proprietaire ? ` - ${p.proprietaire}` : ""}
      </p>
      <div className="fiche__corps">
        {/* A gauche : le "paper doll" */}
        <div className="mannequin">
          <div className="mannequin__colonne mannequin__colonne--gauche">
            {COLONNE_GAUCHE.map((id) => (
              <Emplacement key={id} id={id} p={p} modifiable={modifiable} />
            ))}
          </div>
          <div className="mannequin__modele">
            {/* Ton image portraits/<nom>.png si elle existe ; sinon les initiales. */}
            <span className="mannequin__initiales titre-or">
              {p.nom
                .split(/\s+/)
                .map((mot) => mot[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <img
              src={`${urlPortrait(p.nom)}?remplacement=non`}
              alt=""
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
            />
          </div>
          <div className="mannequin__colonne mannequin__colonne--droite">
            {COLONNE_DROITE.map((id) => (
              <Emplacement key={id} id={id} p={p} modifiable={modifiable} />
            ))}
          </div>
          <div className="mannequin__armes">
            {ARMES.map((id) => (
              <Emplacement key={id} id={id} p={p} modifiable={modifiable} />
            ))}
          </div>
        </div>

        {/* A droite : les statistiques, sur parchemin, dans un volet qui defile */}
        <div className="statistiques cadre--parchemin">
          <details open>
            <summary>Caracteristiques</summary>
            {CARACTERISTIQUES.map((c: string) => (
              <Stat key={c} nom={NOMS_CARACS[c]} valeur={`${p.caracteristiques[c]} (${signe(m[c])})`} variation={m[c]} />
            ))}
          </details>
          <details open>
            <summary>Defense</summary>
            <Stat nom="Classe d'armure" valeur={p.classeArmure} />
            <Stat nom="Points de vie" valeur={`${pv.actuels} / ${pv.max}`} />
            {pv.temporaires > 0 && <Stat nom="PV temporaires" valeur={pv.temporaires} variation={1} />}
            <Stat nom="Des de vie" valeur={`${p.desDeVie.restants} / ${p.niveau} (d${p.desDeVie.faces})`} />
          </details>
          <details open>
            <summary>Combat</summary>
            <Stat nom="Initiative" valeur={signe(p.derives.bonusInitiative)} variation={p.derives.bonusInitiative} />
            <Stat nom="Bonus de maitrise" valeur={signe(p.derives.bonusDeMaitrise)} variation={1} />
            {p.derives.attaques.map((a) => (
              <Stat key={a.emplacement} nom={a.nom} valeur={`${signe(a.bonus)} - ${a.degats} ${a.typeDegats}`} />
            ))}
          </details>
          <details open>
            <summary>Ressources</summary>
            {p.ressources.length === 0 && <Stat nom="Aucune" valeur="-" />}
            {p.ressources.map((r) => (
              <Stat key={r.cle} nom={r.nom} valeur={`${r.actuel} / ${r.max}`} />
            ))}
          </details>
          <details open>
            <summary>Etats</summary>
            {p.etats.length === 0 && <Stat nom="Aucun" valeur="-" />}
            {p.etats.map((etat) => (
              <div key={etat.id} className="stat">
                <span>
                  <img src={urlIcone(etat.icone)} alt="" width={18} height={18} style={{ verticalAlign: "middle" }} /> {etat.nom}
                </span>
                <span className={`stat__valeur ${etat.nature === "buff" ? "stat__valeur--bonus" : "stat__valeur--malus"}`}>
                  {etat.roundsRestants ? `${etat.roundsRestants} rd` : "-"}
                </span>
              </div>
            ))}
          </details>
          <details>
            <summary>Grimoire ({p.grimoire.length})</summary>
            {p.grimoire.map((s) => (
              <Stat key={s.id} nom={s.nom} valeur={s.niveau === 0 ? "Mineur" : `Niv. ${s.niveau}`} />
            ))}
          </details>
        </div>
      </div>
    </Fenetre>
  );
}
