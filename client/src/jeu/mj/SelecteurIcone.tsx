import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu } from "@/core/jeu";
import { urlIcone } from "@/core/medias";

// Aide-memoire : les noms des icones de WoW sont en anglais, mais tres reguliers.
const PREFIXES: [string, string][] = [
  ["inv_misc_head", "Tetes de creatures"],
  ["achievement_boss", "Portraits de boss"],
  ["inv_", "Objets"],
  ["spell_", "Sorts"],
  ["ability_", "Techniques"],
  ["achievement_character", "Races"],
];

type Resultat = { total: number; trouves: number; icones: string[] };

/**
 * Le selecteur d'icones (MJ) : une recherche par nom de fichier dans le
 * dossier icones/ (qui peut contenir toutes les icones de WoW). Le SERVEUR
 * cherche et ne renvoie que 240 resultats au plus ; le navigateur ne charge que
 * les vignettes visibles a l'ecran. S'ouvre au centre, par-dessus tout.
 */
export function SelecteurIcone({ valeur, surChoix, surFermer }: { valeur: string | null; surChoix: (icone: string | null) => void; surFermer: () => void }) {
  const [recherche, setRecherche] = useState("");
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [chargement, setChargement] = useState(false);
  const numero = useRef(0); // seule la reponse a la DERNIERE frappe compte

  const chercher = (texte: string, actualiser = false) => {
    const n = ++numero.current;
    setChargement(true);
    jeu.demander(actualiser ? EVENEMENTS.ICONES_ACTUALISER : EVENEMENTS.ICONES_CHERCHER, actualiser ? {} : { recherche: texte }).then((r) => {
      if (n !== numero.current) return;
      setChargement(false);
      if (r.ok) setResultat(r as unknown as Resultat);
      if (actualiser && texte) chercher(texte);
    });
  };

  // On attend 250 ms apres la derniere frappe avant de chercher.
  useEffect(() => {
    const minuterie = setTimeout(() => chercher(recherche), recherche ? 250 : 0);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  // Echap ferme le selecteur seulement (pas les fenetres derriere).
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

  return createPortal(
    <div className="modale modale--voile" onPointerDown={(e) => e.target === e.currentTarget && surFermer()}>
      <section className="selecteur-icone cadre" role="dialog" aria-label="Choisir une icone">
        <header className="selecteur-icone__entete">
          <h2 className="titre-or">Choisir une icone</h2>
          <button className="bouton-fermer" type="button" onClick={surFermer} aria-label="Fermer">
            x
          </button>
        </header>
        <div className="selecteur-icone__recherche">
          <input
            className="champ"
            value={recherche}
            autoFocus
            maxLength={80}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Mots en anglais : wolf, head gnoll, fire ball, sword..."
            aria-label="Rechercher une icone"
          />
          <button type="button" className="bouton bouton--discret" onClick={() => chercher(recherche, true)} title="Relire le dossier icones/ (apres y avoir ajoute des fichiers)">
            Actualiser
          </button>
        </div>
        <div className="selecteur-icone__prefixes">
          {PREFIXES.map(([prefixe, nom]) => (
            <button key={prefixe} type="button" className="raid__puce" onClick={() => setRecherche(prefixe)}>
              {nom} <small>{prefixe}</small>
            </button>
          ))}
        </div>
        <p className="selecteur-icone__compte">
          {chargement && !resultat
            ? "Lecture du dossier..."
            : resultat
              ? resultat.total === 0
                ? "Ton dossier icones/ ne contient encore aucune image."
                : `${resultat.trouves} icone(s) trouvee(s) sur ${resultat.total}${resultat.trouves > resultat.icones.length ? ` : les ${resultat.icones.length} premieres (precise ta recherche)` : ""}.`
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
              className={`selecteur-icone__case${icone === valeur ? " selecteur-icone__case--choisie" : ""}`}
              onClick={() => choisir(icone)}
              title={icone}
            >
              <img src={`${urlIcone(icone)}?remplacement=non`} alt={icone} loading="lazy" />
            </button>
          ))}
        </div>
      </section>
    </div>,
    couche,
  );
}

/** Un champ "Icone" de formulaire : la vignette actuelle et le bouton qui ouvre le selecteur. */
export function ChampIcone({ valeur, defaut, surChange }: { valeur: string | null; defaut: string; surChange: (icone: string | null) => void }) {
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
      {ouvert && <SelecteurIcone valeur={valeur} surChoix={surChange} surFermer={() => setOuvert(false)} />}
    </div>
  );
}
