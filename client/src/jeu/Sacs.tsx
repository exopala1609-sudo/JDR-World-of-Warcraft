import { useTextures } from "@/core/textures";
import { RARETES } from "@partage/raretes.js";
import { jeu, useJeu } from "@/core/jeu";
import { typeEmplacement, referenceObjet } from "@partage/equipement.js";
import { iconeObjet } from "@/core/medias";
import type { Objet, Personnage } from "@/core/types";
import { Fenetre } from "@/ui/Fenetre";
import { preparerGlisser, useCible } from "@/ui/glisser";
import { avecInfobulle } from "@/ui/InfoBulle";

// Un sac de 20 places (5 x 4), qui grandit si besoin. Avec la texture de WoW
// (UI-BackpackBackground), 4 colonnes et 16 places, comme le sac a dos du jeu.
const COLONNES = 5;
const CASES_MIN = 20;
const COLONNES_TEXTURE = 4;
const CASES_MIN_TEXTURE = 16;

const TYPES: Record<string, string> = {
  arme: "Arme",
  armure: "Armure",
  bouclier: "Bouclier",
  consommable: "Consommable",
  munition: "Munition",
  objet: "Objet",
  tresor: "Tresor",
};

// Ou se porte l'objet (ligne blanche de l'infobulle, comme "Deux mains" dans WoW).
const PORT: Record<string, string> = {
  "une-main": "Une main",
  "deux-mains": "Deux mains",
  "main-gauche": "Main gauche",
  distance: "A distance",
  doigt: "Doigt",
  bijou: "Bijou",
  tete: "Tete",
  cou: "Cou",
  epaules: "Epaules",
  dos: "Dos",
  torse: "Torse",
  chemise: "Chemise",
  tabard: "Tabard",
  poignets: "Poignets",
  mains: "Mains",
  taille: "Taille",
  jambes: "Jambes",
  pieds: "Pieds",
};

/** Infobulle d'objet a la WoW : nom colore par la rarete, caracteristiques, effet en vert. */
export function InfobulleObjet({ objet }: { objet: Objet }) {
  return (
    <div data-rarete={objet.rarete}>
      <div className="infobulle__titre texte-rarete">{objet.nom}</div>
      <div className="infobulle__ligne--gris">
        {(RARETES as Record<string, { nom: string }>)[objet.rarete]?.nom} - {TYPES[objet.type] ?? objet.type}
      </div>
      {typeEmplacement(objet) && <div>{PORT[typeEmplacement(objet) as string] ?? typeEmplacement(objet)}</div>}
      {objet.arme && (
        <>
          <div>
            Degats : {objet.arme.degats} {objet.arme.typeDegats}
          </div>
          {objet.arme.proprietes.length > 0 && <div>{objet.arme.proprietes.join(", ")}</div>}
        </>
      )}
      {objet.armure && <div>+{objet.armure.classeArmure} a la classe d'armure</div>}
      {objet.soins && <div className="infobulle__ligne--vert">Utiliser : rend {objet.soins} points de vie.</div>}
      {objet.description && <div className="infobulle__ligne--or">"{objet.description}"</div>}
      <div className="infobulle__ligne--gris">
        {objet.poids > 0 && `${objet.poids} kg`}
        {objet.valeur > 0 && ` - ${objet.valeur} po`}
      </div>
    </div>
  );
}

/** Une case du sac : on la glisse (vers la fiche, la barre d'actions), clic droit = equiper / utiliser. */
function CaseObjet({ objet, personnage, modifiable }: { objet: Objet; personnage: Personnage; modifiable: boolean }) {
  const clicDroit = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!modifiable) return;
    if (typeEmplacement(objet)) jeu.equiper(personnage.id, objet.id);
    else if (objet.soins) jeu.utiliser(personnage.id, referenceObjet(objet));
  };
  return (
    // data-rarete : c'est lui qui choisit la couleur de la bordure (voir composants.css).
    <div
      className={`case${modifiable ? " case--deplacable" : ""}`}
      data-rarete={objet.rarete}
      onPointerDown={modifiable ? (e) => preparerGlisser(e, { origine: "sac", objet, idPersonnage: personnage.id }) : undefined}
      onContextMenu={clicDroit}
      {...avecInfobulle(() => (
        <>
          <InfobulleObjet objet={objet} />
          {modifiable && typeEmplacement(objet) && <div className="infobulle__ligne--vert">Clic droit : equiper. Ou glisse-le sur ta fiche (C).</div>}
          {modifiable && objet.soins && <div className="infobulle__ligne--vert">Clic droit : utiliser. Glisse-le sur la barre d'actions.</div>}
        </>
      ))}
    >
      <img src={iconeObjet(objet)} alt={objet.nom} />
      {objet.quantite > 1 && <span className="case__quantite">{objet.quantite}</span>}
    </div>
  );
}

/**
 * La valeur du sac en pieces d'or, d'argent et de cuivre (D&D : 1 po = 10 pa
 * = 100 pc), avec les icones de WoW si elles sont dans le dossier interface/.
 */
function Argent({ valeur }: { valeur: number }) {
  const textures = useTextures();
  const cuivre = Math.round(valeur * 100);
  const pieces: [number, string, string | undefined][] = [
    [Math.floor(cuivre / 100), "po", textures["piece-or"]],
    [Math.floor(cuivre / 10) % 10, "pa", textures["piece-argent"]],
    [cuivre % 10, "pc", textures["piece-cuivre"]],
  ];
  if (!textures["piece-or"]) return <span>{cuivre / 100} po</span>;
  return (
    <span className="argent" title={`${cuivre / 100} po`}>
      {pieces
        .filter(([n], i) => n > 0 || i === 0)
        .map(([n, unite, icone]) => (
          <span key={unite} className="argent__piece">
            {n}
            <img src={icone} alt={unite} />
          </span>
        ))}
    </span>
  );
}

export function Sacs({ position }: { position: { x: number; y: number } }) {
  const personnage = useJeu((e) => jeu.personnageDesSacs(e));
  const modifiable = useJeu((e) => Boolean(personnage && (e.profil?.role === "mj" || jeu.mesPersonnages(e).some((p) => p.id === personnage.id))));
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, sacs: false } }));
  const objets = personnage?.inventaire ?? [];
  const texture = Boolean(useTextures()["sac-cadre"]);
  const colonnes = texture ? COLONNES_TEXTURE : COLONNES;
  const nombreDeCases = Math.max(texture ? CASES_MIN_TEXTURE : CASES_MIN, Math.ceil(objets.length / colonnes) * colonnes);
  const poids = objets.reduce((total, o) => total + o.poids * o.quantite, 0);
  const valeur = objets.reduce((total, o) => total + o.valeur * o.quantite, 0);

  // Le sac recoit : un objet du butin (on le prend), ou une piece d'equipement (on la range).
  const depot = useCible("sac", {
    accepte: (c) => modifiable && (c.origine === "butin" || (c.origine === "equipement" && c.idPersonnage === personnage?.id)),
    deposer: (c) => {
      if (c.origine === "butin") jeu.prendreButin(c.objet, c.idButin, personnage?.id);
      else if (c.origine === "equipement") jeu.desequiper(c.idPersonnage, c.emplacement);
    },
  });

  return (
    <Fenetre titre={personnage ? `Sac de ${personnage.nom}` : "Sac"} classe="sacs" positionInitiale={position} surFermer={fermer}>
      <div className={`sacs__grille${depot.possible ? " zone--possible" : ""}${depot.survolee ? " zone--survolee" : ""}`} {...depot.proprietes}>
        {Array.from({ length: nombreDeCases }, (_, index) => {
          const objet = objets[index];
          if (!objet || !personnage) return <div key={`vide-${index}`} className="case case--vide-sac" />;
          return <CaseObjet key={objet.id} objet={objet} personnage={personnage} modifiable={modifiable} />;
        })}
      </div>
      <div className="sacs__pied">
        <span>{personnage ? `${objets.length} objet(s) - ${Math.round(poids * 10) / 10} kg` : "Aucun personnage"}</span>
        <Argent valeur={valeur} />
      </div>
    </Fenetre>
  );
}
