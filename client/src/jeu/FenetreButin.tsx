import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import { iconeObjet } from "@/core/medias";
import { useEchelleInterface } from "@/core/useEchelleInterface";
import { InfobulleObjet } from "@/jeu/Sacs";
import { preparerGlisser } from "@/ui/glisser";
import { avecInfobulle } from "@/ui/InfoBulle";

const LARGEUR = 300;
const HAUTEUR_LIGNE = 52;

/**
 * Fenetre de butin facon WoW : une petite colonne ouverte a cote du curseur,
 * une ligne par objet (icone bordee de sa rarete, nom colore). Clic sur une
 * ligne = la prendre ; on peut aussi la glisser jusqu'a son sac.
 * Elle se met a jour en direct quand un autre joueur se sert.
 */
export function FenetreButin() {
  const butin = useJeu((e) => e.butin);
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const { largeur, hauteur } = useEchelleInterface();
  if (!butin) return null;

  // Toujours entierement a l'ecran, meme si l'on clique pres d'un bord.
  const hauteurEstimee = 90 + Math.max(1, butin.objets.length) * HAUTEUR_LIGNE;
  const left = Math.min(butin.x + 18, largeur - LARGEUR - 12);
  const top = Math.max(12, Math.min(butin.y - 30, hauteur - hauteurEstimee - 12));

  return (
    <section className="butin cadre" style={{ left, top, width: LARGEUR }} role="dialog" aria-label={butin.nom}>
      <header className="butin__entete">
        <span className={`butin__embleme butin__embleme--${butin.genre}`} aria-hidden="true">
          {butin.genre === "cadavre" ? "☠" : "▣"}
        </span>
        <h2 className="titre-or butin__titre">{butin.nom}</h2>
        {estMJ && (
          <button
            className="butin__supprimer"
            type="button"
            onClick={() => {
              jeu.demander(EVENEMENTS.BUTIN_SUPPRIMER, { idButin: butin.id });
              jeu.fermerButin();
            }}
            {...avecInfobulle(() => <div>Supprimer ce butin de la carte (MJ)</div>)}
          >
            ✕ Supprimer
          </button>
        )}
        <button className="bouton-fermer" type="button" onClick={() => jeu.fermerButin()} aria-label="Fermer">
          x
        </button>
      </header>
      <div className="butin__liste">
        {butin.objets.length === 0 && <p className="butin__vide">Il n'y a plus rien.</p>}
        {butin.objets.map((objet) => (
          <button
            key={objet.id}
            type="button"
            className="butin__ligne"
            data-rarete={objet.rarete}
            onClick={() => jeu.prendreButin(objet)}
            onPointerDown={(e) => preparerGlisser(e, { origine: "butin", objet, idButin: butin.id })}
            {...avecInfobulle(() => (
              <>
                <InfobulleObjet objet={objet} />
                <div className="infobulle__ligne--vert">Clic : prendre. Ou glisse-le dans ton sac.</div>
              </>
            ))}
          >
            <span className="case butin__icone" data-rarete={objet.rarete}>
              <img src={iconeObjet(objet)} alt="" />
              {objet.quantite > 1 && <span className="case__quantite">{objet.quantite}</span>}
            </span>
            <span className="butin__nom texte-rarete">{objet.nom}</span>
          </button>
        ))}
      </div>
      {butin.objets.length > 1 && (
        <button className="bouton butin__tout" type="button" onClick={() => butin.objets.forEach((o) => jeu.prendreButin(o))}>
          Tout prendre
        </button>
      )}
    </section>
  );
}
