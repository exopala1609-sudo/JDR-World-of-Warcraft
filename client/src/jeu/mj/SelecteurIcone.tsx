import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu } from "@/core/jeu";
import { urlIcone } from "@/core/medias";

// Les categories de la galerie : les noms des icones de WoW sont en anglais,
// mais tres reguliers (un prefixe par famille). Un clic suffit, rien a taper.
const CATEGORIES: [string, string][] = [
  ["", "Toutes"],
  ["spell_", "Sorts"],
  ["ability_", "Techniques"],
  ["inv_", "Objets"],
  ["inv_misc_head", "Tetes de creatures"],
  ["achievement_boss", "Boss"],
  ["achievement_character", "Races"],
  ["classicon", "Classes"],
];

type Resultat = { total: number; trouves: number; debut: number; icones: string[] };
const PAR_PAGE = 240; // le serveur renvoie 240 icones au plus par page

/**
 * La galerie d'icones (MJ) : on parcourt le dossier icones/ (qui peut contenir
 * toutes les icones de WoW) par CATEGORIE et par PAGE, et un clic sur l'image
 * l'assigne. Le filtre texte est facultatif. C'est le SERVEUR qui lit le dossier
 * et ne renvoie qu'une page ; le navigateur ne charge que les vignettes
 * visibles. La fenetre se deplace en tirant sa barre de titre.
 */
export function SelecteurIcone({
  valeur,
  surChoix,
  surFermer,
  categorie = "",
}: {
  valeur: string | null;
  surChoix: (icone: string | null) => void;
  surFermer: () => void;
  categorie?: string; // ex. "spell_" pour un sort : la galerie s'ouvre sur cette famille
}) {
  const [famille, setFamille] = useState(categorie);
  const [filtre, setFiltre] = useState("");
  const [debut, setDebut] = useState(0);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [chargement, setChargement] = useState(false);
  const [decalage, setDecalage] = useState({ x: 0, y: 0 }); // la fenetre deplacee
  const tirage = useRef<{ x: number; y: number; depart: { x: number; y: number } } | null>(null);
  const numero = useRef(0); // seule la reponse a la DERNIERE demande compte

  const recherche = [famille, filtre.trim()].filter(Boolean).join(" ");
  const chercher = (actualiser = false) => {
    const n = ++numero.current;
    setChargement(true);
    const demande = actualiser ? jeu.demander(EVENEMENTS.ICONES_ACTUALISER, {}) : jeu.demander(EVENEMENTS.ICONES_CHERCHER, { recherche, debut });
    demande.then((r) => {
      if (n !== numero.current) return;
      setChargement(false);
      if (actualiser) return chercher();
      if (r.ok) setResultat(r as unknown as Resultat);
    });
  };

  // Nouvelle categorie ou nouveau filtre : retour a la premiere page.
  useEffect(() => setDebut(0), [famille, filtre]);
  // On attend 250 ms apres la derniere frappe du filtre avant de chercher.
  useEffect(() => {
    const minuterie = setTimeout(() => chercher(), filtre ? 250 : 0);
    return () => clearTimeout(minuterie);
  }, [recherche, debut]);

  // Echap ferme la galerie seulement (pas les fenetres derriere).
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      surFermer();
    };
    window.addEventListener("keydown", echap, true);
    return () => window.removeEventListener("keydown", echap, true);
  }, [surFermer]);

  const choisir = (icone: string | null) => {
    surChoix(icone);
    surFermer();
  };
  const couche = document.querySelector(".couche-modale");
  if (!couche) return null;

  const pages = resultat ? Math.max(1, Math.ceil(resultat.trouves / PAR_PAGE)) : 1;
  const page = resultat ? Math.floor(resultat.debut / PAR_PAGE) + 1 : 1;
  const echelle = () => {
    const scene = document.querySelector(".scene-jeu") as HTMLElement | null;
    return scene ? scene.getBoundingClientRect().width / scene.offsetWidth : 1;
  };

  return createPortal(
    <div className="modale modale--voile" onPointerDown={(e) => e.target === e.currentTarget && surFermer()}>
      <section className="selecteur-icone cadre" role="dialog" aria-label="Galerie d'icones" style={{ transform: `translate(${decalage.x}px, ${decalage.y}px)` }}>
        <header
          className="selecteur-icone__entete"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            tirage.current = { x: e.clientX, y: e.clientY, depart: decalage };
          }}
          onPointerMove={(e) => {
            const t = tirage.current;
            if (!t) return;
            const k = echelle();
            setDecalage({ x: t.depart.x + (e.clientX - t.x) / k, y: t.depart.y + (e.clientY - t.y) / k });
          }}
          onPointerUp={() => (tirage.current = null)}
        >
          <h2 className="titre-or">Galerie d'icones</h2>
          <button className="bouton-fermer" type="button" onClick={surFermer} aria-label="Fermer">
            x
          </button>
        </header>
        <div className="selecteur-icone__categories" role="tablist">
          {CATEGORIES.map(([prefixe, nom]) => (
            <button
              key={prefixe || "toutes"}
              type="button"
              role="tab"
              aria-selected={famille === prefixe}
              className={`onglet${famille === prefixe ? " onglet--actif" : ""}`}
              onClick={() => setFamille(prefixe)}
            >
              {nom}
            </button>
          ))}
        </div>
        <div className="selecteur-icone__recherche">
          <input
            className="champ"
            value={filtre}
            maxLength={60}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Filtrer (facultatif) : fire, frost, wolf, sword..."
            aria-label="Filtrer les icones"
          />
          <button type="button" className="bouton bouton--discret" onClick={() => chercher(true)} title="Relire le dossier icones/ (apres y avoir ajoute des fichiers)">
            Actualiser
          </button>
        </div>
        <p className="selecteur-icone__compte">
          {chargement && !resultat
            ? "Lecture du dossier..."
            : resultat
              ? resultat.total === 0
                ? "Ton dossier icones/ ne contient encore aucune image."
                : `${resultat.trouves} icone(s) sur ${resultat.total}. Clic sur une image pour la choisir.`
              : ""}
        </p>
        <div className="selecteur-icone__grille">
          <button type="button" className={`selecteur-icone__case selecteur-icone__case--aucune${valeur === null ? " selecteur-icone__case--choisie" : ""}`} onClick={() => choisir(null)} title="Aucune icone (par defaut)">
            Aucune
          </button>
          {resultat?.icones.map((icone) => (
            <button
              key={icone}
              type="button"
              className={`selecteur-icone__case${icone.toLowerCase() === valeur?.toLowerCase() ? " selecteur-icone__case--choisie" : ""}`}
              onClick={() => choisir(icone)}
              title={icone}
            >
              <img src={`${urlIcone(icone)}?remplacement=non`} alt={icone} loading="lazy" />
            </button>
          ))}
        </div>
        {pages > 1 && (
          <div className="selecteur-icone__pages">
            <button type="button" className="bouton-page" disabled={page <= 1} onClick={() => setDebut(Math.max(0, (page - 2) * PAR_PAGE))} aria-label="Page precedente">
              {"<"}
            </button>
            <span>
              Page {page} / {pages}
            </span>
            <button type="button" className="bouton-page" disabled={page >= pages} onClick={() => setDebut(page * PAR_PAGE)} aria-label="Page suivante">
              {">"}
            </button>
          </div>
        )}
      </section>
    </div>,
    couche,
  );
}

/** Un champ "Icone" de formulaire : la vignette actuelle et le bouton qui ouvre le selecteur. */
export function ChampIcone({
  valeur,
  defaut,
  surChange,
  categorie,
}: {
  valeur: string | null;
  defaut: string;
  surChange: (icone: string | null) => void;
  categorie?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="champ-icone">
      <button type="button" className="case champ-icone__apercu" onClick={() => setOuvert(true)} title="Choisir une icone">
        <img src={urlIcone(valeur ?? defaut)} alt="" />
      </button>
      <div className="champ-icone__texte">
        <span className="champ-icone__nom">{valeur ?? "(par defaut)"}</span>
        <span className="champ-icone__actions">
          <button type="button" className="menu-mj__retirer" onClick={() => setOuvert(true)}>
            Choisir...
          </button>
          {valeur && (
            <button type="button" className="menu-mj__retirer" onClick={() => surChange(null)}>
              Retirer
            </button>
          )}
        </span>
      </div>
      {ouvert && <SelecteurIcone valeur={valeur} surChoix={surChange} surFermer={() => setOuvert(false)} categorie={categorie} />}
    </div>
  );
}
