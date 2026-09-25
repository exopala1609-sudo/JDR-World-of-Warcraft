import { RARETES } from "@partage/raretes.js";
import { jeu, useJeu } from "@/core/jeu";
import { nomDeFichier, urlIcone } from "@/core/medias";
import type { Objet } from "@/core/types";
import { Fenetre } from "@/ui/Fenetre";
import { avecInfobulle } from "@/ui/InfoBulle";

const COLONNES = 5;
const CASES_MIN = 20; // un sac de 20 places, qui grandit si besoin

const TYPES: Record<string, string> = {
  arme: "Arme",
  armure: "Armure",
  bouclier: "Bouclier",
  consommable: "Consommable",
  munition: "Munition",
  objet: "Objet",
  tresor: "Tresor",
};

/** Infobulle d'objet a la WoW : nom colore par la rarete, caracteristiques, effet en vert. */
export function InfobulleObjet({ objet }: { objet: Objet }) {
  return (
    <div data-rarete={objet.rarete}>
      <div className="infobulle__titre texte-rarete">{objet.nom}</div>
      <div className="infobulle__ligne--gris">
        {(RARETES as Record<string, { nom: string }>)[objet.rarete]?.nom} - {TYPES[objet.type] ?? objet.type}
      </div>
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

export function Sacs({ position }: { position: { x: number; y: number } }) {
  const personnage = useJeu((e) => jeu.personnageDesSacs(e));
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, sacs: false } }));
  const objets = personnage?.inventaire ?? [];
  const nombreDeCases = Math.max(CASES_MIN, Math.ceil(objets.length / COLONNES) * COLONNES);
  const poids = objets.reduce((total, o) => total + o.poids * o.quantite, 0);
  const valeur = objets.reduce((total, o) => total + o.valeur * o.quantite, 0);

  return (
    <Fenetre titre={personnage ? `Sac de ${personnage.nom}` : "Sac"} classe="sacs" positionInitiale={position} surFermer={fermer}>
      <div className="sacs__grille">
        {Array.from({ length: nombreDeCases }, (_, index) => {
          const objet = objets[index];
          if (!objet) return <div key={`vide-${index}`} className="case" />;
          return (
            // data-rarete : c'est lui qui choisit la couleur de la bordure (voir composants.css).
            <div key={objet.id} className="case" data-rarete={objet.rarete} {...avecInfobulle(() => <InfobulleObjet objet={objet} />)}>
              <img src={urlIcone(objet.icone ?? objet.source ?? nomDeFichier(objet.nom))} alt={objet.nom} />
              {objet.quantite > 1 && <span className="case__quantite">{objet.quantite}</span>}
            </div>
          );
        })}
      </div>
      <div className="sacs__pied">
        <span>{personnage ? `${objets.length} objet(s) - ${Math.round(poids * 10) / 10} kg` : "Aucun personnage"}</span>
        <span>{Math.round(valeur * 100) / 100} po</span>
      </div>
    </Fenetre>
  );
}
