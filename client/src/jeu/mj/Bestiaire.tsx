import { useEffect, useState } from "react";
import { modificateur } from "@partage/dnd5e.js";
import { NOMS_CARACTERISTIQUES } from "@partage/creation.js";
import { jeu, useJeu } from "@/core/jeu";
import { signe } from "@/core/journal";
import { urlIcone } from "@/core/medias";
import type { Monstre } from "@/core/types";
import { Fenetre } from "@/ui/Fenetre";
import { preparerGlisser } from "@/ui/glisser";
import { avecInfobulle } from "@/ui/InfoBulle";
import { EVENEMENTS } from "@partage/protocole.js";
import { FormulaireMonstre } from "./FormulaireMonstre";

const ABREGES: Record<string, string> = { force: "FOR", dexterite: "DEX", constitution: "CON", intelligence: "INT", sagesse: "SAG", charisme: "CHA" };

/** La fiche d'un monstre, sur parchemin (facon bloc de statistiques). */
function FicheMonstre({ m }: { m: Monstre }) {
  return (
    <article className="bestiaire__fiche">
      <h3 className="bestiaire__nom">{m.nom}</h3>
      <p className="bestiaire__type">
        {[m.type, m.puissance].filter(Boolean).join(" - ") || "Monstre"}
      </p>
      <div className="bestiaire__chiffres">
        <span>
          <strong>Classe d'armure</strong> {m.classeArmure}
        </span>
        <span>
          <strong>Points de vie</strong> {m.pv}
        </span>
        <span>
          <strong>Vitesse</strong> {m.vitesse}
          {m.taille > 1 ? ` - pion ${m.taille} x ${m.taille} cases` : ""}
        </span>
      </div>
      <div className="bestiaire__caracs">
        {Object.entries(m.caracteristiques).map(([c, v]) => (
          <div key={c} title={(NOMS_CARACTERISTIQUES as Record<string, string>)[c]}>
            <strong>{ABREGES[c]}</strong>
            <span>
              {v} ({signe(modificateur(v))})
            </span>
          </div>
        ))}
      </div>
      {m.attaques.length > 0 && (
        <>
          <h4 className="bestiaire__rubrique">Actions</h4>
          {m.attaques.map((a) => (
            <p key={a.nom} className="bestiaire__texte">
              <em>{a.nom}.</em> {signe(a.toucher)} au toucher, {a.degats} degats {a.type}.
            </p>
          ))}
        </>
      )}
      {m.butin.length > 0 && (
        <>
          <h4 className="bestiaire__rubrique">Butin</h4>
          <p className="bestiaire__texte">{m.butin.map((b) => `${b.id}${b.quantite > 1 ? ` x${b.quantite}` : ""}`).join(", ")}</p>
        </>
      )}
      {m.description && <p className="bestiaire__texte bestiaire__description">{m.description}</p>}
    </article>
  );
}

/**
 * Le Bestiaire du MJ, facon "Collections" de WoW : a gauche les monstres du
 * compendium (fichiers JSON, section "monstres"), a droite la fiche de celui
 * qu'on survole. GLISSER une carte de monstre sur la carte du jeu l'y fait
 * apparaitre (fiche de PNJ + pion). Un coffre vide se glisse de la meme facon.
 */
export function Bestiaire({ position }: { position: { x: number; y: number } }) {
  const compendium = useJeu((e) => e.compendium);
  const cache = useJeu((e) => e.invocationCachee);
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState<string | null>(null);
  // Formulaire ouvert : "nouveau" (vierge), ou le monstre a modifier / dupliquer.
  const [edition, setEdition] = useState<{ modele: Monstre | null } | null>(null);
  const [supprimer, setSupprimer] = useState(false);
  const fermer = () => jeu.modifier((e) => ({ fenetres: { ...e.fenetres, bestiaire: false } }));

  useEffect(() => {
    jeu.chargerCompendium();
  }, []);

  const filtre = recherche.trim().toLocaleLowerCase("fr");
  const monstres = (compendium?.monstres ?? []).filter((m) => !filtre || `${m.nom} ${m.type}`.toLocaleLowerCase("fr").includes(filtre));
  const affiche = monstres.find((m) => m.id === choisi) ?? monstres[0] ?? null;

  return (
    <Fenetre titre="Bestiaire" classe="bestiaire" positionInitiale={position} surFermer={fermer}>
      <div className="bestiaire__barre">
        <input className="champ" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un monstre..." aria-label="Rechercher" />
        <label className="bestiaire__option" {...avecInfobulle(() => <div>Coche : le monstre apparait CACHE aux joueurs. Tu le reveles ensuite (clic droit sur son pion).</div>)}>
          <input type="checkbox" checked={cache} onChange={(e) => jeu.modifier({ invocationCachee: e.target.checked })} /> Apparait cache
        </label>
      </div>
      <div className="bestiaire__corps">
        <div className="bestiaire__liste">
          {!compendium && <p className="bestiaire__vide">Chargement...</p>}
          {compendium && monstres.length === 0 && (
            <p className="bestiaire__vide">Aucun monstre. Ajoute une section "monstres" a ton compendium (voir exemple-bestiaire.json).</p>
          )}
          {monstres.map((m) => (
            <div
              key={m.id}
              className={`carte-monstre${affiche?.id === m.id ? " carte-monstre--choisie" : ""}`}
              onPointerDown={(e) => preparerGlisser(e, { origine: "bestiaire", monstre: m })}
              onPointerEnter={() => !edition && setChoisi(m.id)}
              onClick={() => {
                setChoisi(m.id);
                setSupprimer(false);
              }}
            >
              <span className="case carte-monstre__icone">
                <img src={urlIcone(m.icone ?? m.id)} alt="" />
              </span>
              <span className="carte-monstre__texte">
                <span className="carte-monstre__nom">{m.nom}</span>
                <span className="carte-monstre__detail">{m.puissance || m.type}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="bestiaire__detail">
          {edition ? (
            <FormulaireMonstre
              key={edition.modele?.id ?? "nouveau"}
              modele={edition.modele}
              surFin={(id) => {
                setEdition(null);
                if (id) setChoisi(id);
              }}
            />
          ) : affiche ? (
            <>
              <FicheMonstre m={affiche} />
              <div className="bestiaire__actions">
                <button type="button" className="bouton bouton--discret" onClick={() => setEdition({ modele: affiche })}>
                  {affiche.modifiable ? "Modifier" : "Dupliquer pour modifier"}
                </button>
                {affiche.modifiable && (
                  <button
                    type="button"
                    className={`bouton bouton--discret${supprimer ? " bouton--danger" : ""}`}
                    onClick={() => {
                      if (!supprimer) return setSupprimer(true);
                      setSupprimer(false);
                      jeu.demander(EVENEMENTS.BESTIAIRE_SUPPRIMER, { idMonstre: affiche.id });
                    }}
                  >
                    {supprimer ? "Confirmer la suppression ?" : "Supprimer"}
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="bestiaire__pied">
        <div className="carte-monstre carte-monstre--coffre" onPointerDown={(e) => preparerGlisser(e, { origine: "coffre" })}>
          <span className="case carte-monstre__icone" data-rarete="classique">
            <img src={urlIcone("coffre")} alt="" />
          </span>
          <span className="carte-monstre__texte">
            <span className="carte-monstre__nom">Coffre</span>
            <span className="carte-monstre__detail">a remplir depuis le Compendium</span>
          </span>
        </div>
        <button type="button" className="bouton" onClick={() => setEdition({ modele: null })}>
          + Nouveau monstre / PNJ
        </button>
        <p className="bestiaire__astuce">Glisse un monstre (ou le coffre) sur la carte pour l'y poser.</p>
      </div>
    </Fenetre>
  );
}
