import { CARACTERISTIQUES, CLASSES } from "@partage/dnd5e.js";
import { signe } from "@/core/journal";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone, urlPortrait } from "@/core/medias";
import { Fenetre } from "@/ui/Fenetre";
import { avecInfobulle } from "@/ui/InfoBulle";

// Les emplacements d'equipement, disposes comme dans WoW.
const COLONNE_GAUCHE = ["Tete", "Cou", "Epaules", "Dos", "Torse", "Chemise", "Tabard", "Poignets"];
const COLONNE_DROITE = ["Mains", "Taille", "Jambes", "Pieds", "Doigt", "Doigt", "Bijou", "Bijou"];
const ARMES = ["Main droite", "Main gauche", "A distance"];

const NOMS_CARACS: Record<string, string> = {
  force: "Force",
  dexterite: "Dexterite",
  constitution: "Constitution",
  intelligence: "Intelligence",
  sagesse: "Sagesse",
  charisme: "Charisme",
};

function Emplacement({ nom }: { nom: string }) {
  return (
    <div
      className="case case--vide"
      {...avecInfobulle(() => (
        <>
          <div className="infobulle__titre">{nom}</div>
          <div className="infobulle__ligne--gris">Emplacement vide (l'equipement arrive dans un prochain sprint).</div>
        </>
      ))}
    >
      <span className="case__libelle">{nom}</span>
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
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, personnage: false } }));

  if (!p) {
    return (
      <Fenetre titre="Personnage" classe="fiche" positionInitiale={position} surFermer={fermer}>
        <p className="fiche__sous-titre">Aucun personnage. Cree le tien depuis la page de test.</p>
      </Fenetre>
    );
  }

  const m = p.derives.modificateurs;
  const pv = p.pointsDeVie;
  return (
    <Fenetre titre={p.nom} classe="fiche" positionInitiale={position} surFermer={fermer}>
      <p className="fiche__sous-titre">
        Niveau {p.niveau} {(CLASSES as Record<string, { nom: string }>)[p.classe]?.nom}
        {p.proprietaire ? ` - ${p.proprietaire}` : ""}
      </p>
      <div className="fiche__corps">
        {/* A gauche : le "paper doll" */}
        <div className="mannequin">
          <div className="mannequin__colonne mannequin__colonne--gauche">
            {COLONNE_GAUCHE.map((nom, i) => (
              <Emplacement key={`g${i}`} nom={nom} />
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
            {COLONNE_DROITE.map((nom, i) => (
              <Emplacement key={`d${i}`} nom={nom} />
            ))}
          </div>
          <div className="mannequin__armes">
            {ARMES.map((nom) => (
              <Emplacement key={nom} nom={nom} />
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
