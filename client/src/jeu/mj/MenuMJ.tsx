import { useEffect, useRef, useState } from "react";
import { ETATS_DE_BASE } from "@partage/etats.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone } from "@/core/medias";
import { useEchelleInterface } from "@/core/useEchelleInterface";

const LARGEUR = 300;

/**
 * Le menu contextuel du MJ (clic droit sur un cadre du groupe ou sur un pion
 * de la carte), facon menu deroulant de WoW. Il agit DIRECTEMENT, sans jet de
 * des : PV, alterations, cacher le pion, expulser le joueur.
 * Il n'existe que chez le MJ : et chaque demande est de toute facon refusee
 * par le serveur si elle ne vient pas du MJ.
 */
export function MenuMJ() {
  const menu = useJeu((e) => e.menu);
  const p = useJeu((e) => (e.menu ? e.personnages[e.menu.idPersonnage] : null));
  const pion = useJeu((e) => (e.menu ? e.scene?.pions.find((x) => x.idPersonnage === e.menu!.idPersonnage) : undefined));
  const enLigne = useJeu((e) => Boolean(p?.proprietaire && e.presence.some((c) => c.pseudo.toLocaleLowerCase("fr") === p.proprietaire!.toLocaleLowerCase("fr"))));
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const auCombat = useJeu((e) => (e.combat ? (e.menu ? e.combat.participants.some((c) => c.idPersonnage === e.menu!.idPersonnage) : false) : null));
  const [supprimer, setSupprimer] = useState(false);
  const { largeur, hauteur } = useEchelleInterface();
  const [montant, setMontant] = useState(5);
  const [etat, setEtat] = useState("");
  const [confirmer, setConfirmer] = useState(false);
  const refMenu = useRef<HTMLDivElement>(null);
  const fermer = () => jeu.modifier({ menu: null });

  // Fermeture : clic en dehors, ou Echap.
  useEffect(() => {
    if (!menu) return;
    setConfirmer(false);
    setSupprimer(false);
    const dehors = (e: PointerEvent) => !refMenu.current?.contains(e.target as Node) && fermer();
    const echap = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      fermer();
    };
    window.addEventListener("pointerdown", dehors, true);
    window.addEventListener("keydown", echap, true);
    return () => {
      window.removeEventListener("pointerdown", dehors, true);
      window.removeEventListener("keydown", echap, true);
    };
  }, [menu?.idPersonnage, menu?.x, menu?.y]);

  if (!menu || !p || !estMJ) return null;
  const pv = p.pointsDeVie;
  const modifierPv = (type: "degats" | "soins" | "temporaires", valeur = montant) =>
    valeur > 0 && jeu.demander(EVENEMENTS.PERSONNAGE_MODIFIER_PV, { idPersonnage: p.id, type, montant: valeur });
  // "Fixer a N PV" : on calcule l'ecart, puis degats ou soins.
  const fixerPv = () => {
    const cible = Math.max(0, Math.min(pv.max, montant));
    if (cible < pv.actuels) modifierPv("degats", pv.actuels - cible + pv.temporaires); // les PV temporaires partent en premier
    else if (cible > pv.actuels) modifierPv("soins", cible - pv.actuels);
  };
  // Toujours entierement a l'ecran, meme pres d'un bord.
  const left = Math.min(menu.x + 4, largeur - LARGEUR - 12);
  const top = Math.max(12, Math.min(menu.y + 4, hauteur - 520));

  return (
    <div ref={refMenu} className="menu-mj cadre" style={{ left, top, width: LARGEUR }} role="menu" aria-label={`Menu MJ : ${p.nom}`} onContextMenu={(e) => e.preventDefault()}>
      <header className="menu-mj__entete">
        <span className="menu-mj__nom">{p.nom}</span>
        <span className="menu-mj__detail">
          {p.proprietaire ? `Joueur : ${p.proprietaire}${enLigne ? "" : " (hors ligne)"}` : "PNJ / monstre"}
        </span>
      </header>

      <section className="menu-mj__section">
        <h3 className="menu-mj__titre">
          Points de vie : {pv.actuels} / {pv.max}
          {pv.temporaires ? ` (+${pv.temporaires})` : ""}
        </h3>
        <div className="menu-mj__ligne">
          <input
            className="champ menu-mj__nombre"
            type="number"
            min={1}
            max={999}
            value={montant}
            onChange={(e) => setMontant(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
            aria-label="Montant"
          />
          <button type="button" className="menu-mj__bouton menu-mj__bouton--degats" onClick={() => modifierPv("degats")}>
            Degats
          </button>
          <button type="button" className="menu-mj__bouton menu-mj__bouton--soins" onClick={() => modifierPv("soins")}>
            Soins
          </button>
        </div>
        <div className="menu-mj__ligne">
          <button type="button" className="menu-mj__bouton" onClick={fixerPv}>
            Fixer a {Math.min(pv.max, montant)} PV
          </button>
          <button type="button" className="menu-mj__bouton" onClick={() => modifierPv("temporaires")}>
            PV temporaires
          </button>
        </div>
      </section>

      <section className="menu-mj__section">
        <h3 className="menu-mj__titre">Alterations</h3>
        {p.etats.length === 0 && <p className="menu-mj__vide">Aucune.</p>}
        {p.etats.map((e) => (
          <div key={e.id} className="menu-mj__etat">
            <img className={`aura aura--${e.nature}`} src={urlIcone(e.icone)} alt="" />
            <span className={e.nature === "buff" ? "menu-mj__buff" : "menu-mj__debuff"}>
              {e.nom}
              {e.roundsRestants !== null ? ` (${e.roundsRestants})` : ""}
            </span>
            <button type="button" className="menu-mj__retirer" onClick={() => jeu.demander(EVENEMENTS.ETAT_RETIRER, { idPersonnage: p.id, idEtat: e.id })}>
              Retirer
            </button>
          </div>
        ))}
        <div className="menu-mj__ligne">
          <select className="champ menu-mj__choix" value={etat} onChange={(e) => setEtat(e.target.value)} aria-label="Etat a poser">
            <option value="">Poser un etat...</option>
            {Object.entries(ETATS_DE_BASE).map(([cle, def]) => (
              <option key={cle} value={cle}>
                {def.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="menu-mj__bouton"
            disabled={!etat}
            onClick={() => {
              jeu.demander(EVENEMENTS.ETAT_POSER, { idPersonnage: p.id, cle: etat });
              setEtat("");
            }}
          >
            Poser
          </button>
        </div>
      </section>

      {p.ressources.length > 0 && (
        <section className="menu-mj__section">
          <h3 className="menu-mj__titre">Ressources</h3>
          {p.ressources.map((r) => (
            <div key={r.cle} className="menu-mj__ressource">
              <span>
                {r.nom} {r.actuel} / {r.max}
              </span>
              {[-10, -1, 1, 10]
                .filter((v) => Math.abs(v) === 1 || r.max >= 20)
                .map((v) => (
                  <button key={v} type="button" className="menu-mj__retirer" onClick={() => jeu.demander(EVENEMENTS.RESSOURCE_MODIFIER, { idPersonnage: p.id, cle: r.cle, variation: v })}>
                    {v > 0 ? `+${v}` : v}
                  </button>
                ))}
            </div>
          ))}
        </section>
      )}

      <section className="menu-mj__section">
        <div className="menu-mj__ligne">
          <button type="button" className="menu-mj__bouton" onClick={() => jeu.demander(EVENEMENTS.REPOS_COURT, { idPersonnage: p.id, desDeVie: Math.min(1, p.desDeVie.restants) })}>
            Repos court (1 de de vie)
          </button>
          <button type="button" className="menu-mj__bouton" onClick={() => jeu.demander(EVENEMENTS.REPOS_LONG, { idPersonnage: p.id })}>
            Repos long
          </button>
        </div>
        <button
          type="button"
          className="menu-mj__action"
          onClick={() => {
            jeu.modifier((e) => ({ selection: p.id, fenetres: { ...e.fenetres, personnage: true, sacs: true } }));
            fermer();
          }}
        >
          Ouvrir sa fiche et son sac
        </button>
        {auCombat === false && (
          <button type="button" className="menu-mj__action" onClick={() => jeu.demander(EVENEMENTS.COMBAT_AJOUTER, { idPersonnage: p.id })}>
            Ajouter au combat
          </button>
        )}
      </section>

      <section className="menu-mj__section">
        {pion && (
          <>
            <button type="button" className="menu-mj__action" onClick={() => jeu.demander(EVENEMENTS.PION_CACHER, { idPion: pion.id, cache: !pion.cache })}>
              {pion.cache ? "Reveler aux joueurs" : "Cacher aux joueurs"}
            </button>
            <button
              type="button"
              className="menu-mj__action"
              onClick={() => {
                jeu.demander(EVENEMENTS.PION_RETIRER, { idPion: pion.id });
                fermer();
              }}
            >
              Retirer de la carte
            </button>
          </>
        )}
        {!pion && (
          <button type="button" className="menu-mj__action" onClick={() => jeu.demander(EVENEMENTS.PION_PLACER, { idPersonnage: p.id })}>
            Placer sur la carte
          </button>
        )}
        {!p.proprietaire && pion && (
          <button
            type="button"
            className="menu-mj__action"
            onClick={() => {
              jeu.demander(EVENEMENTS.PION_EN_CADAVRE, { idPion: pion.id });
              fermer();
            }}
          >
            Tue : laisser un cadavre a fouiller
          </button>
        )}
        {!p.proprietaire && (
          <button
            type="button"
            className={`menu-mj__action menu-mj__action--danger${supprimer ? " menu-mj__action--confirmer" : ""}`}
            onClick={() => {
              if (!supprimer) return setSupprimer(true);
              jeu.demander(EVENEMENTS.PERSONNAGE_SUPPRIMER, { idPersonnage: p.id });
              fermer();
            }}
          >
            {supprimer ? "Confirmer la suppression ?" : "Supprimer ce PNJ"}
          </button>
        )}
        {p.proprietaire && (
          <>
            <button
              type="button"
              className={`menu-mj__action menu-mj__action--danger${confirmer ? " menu-mj__action--confirmer" : ""}`}
              onClick={async () => {
                if (!confirmer) return setConfirmer(true);
                if ((await jeu.demander(EVENEMENTS.JOUEUR_EXPULSER, { pseudo: p.proprietaire! })).ok) {
                  jeu.journaliser(`${p.proprietaire} a ete expulse de la table.`, "erreur");
                  fermer();
                }
              }}
            >
              {confirmer ? `Confirmer : expulser ${p.proprietaire} ?` : `Expulser ${p.proprietaire}`}
            </button>
            {!enLigne && (
              <button
                type="button"
                className="menu-mj__action"
                onClick={async () => {
                  if ((await jeu.demander(EVENEMENTS.JOUEUR_READMETTRE, { pseudo: p.proprietaire! })).ok) {
                    jeu.journaliser(`${p.proprietaire} peut de nouveau rejoindre la table.`);
                  }
                }}
              >
                Readmettre {p.proprietaire}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
