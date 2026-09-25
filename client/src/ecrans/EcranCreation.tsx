import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  apercuPersonnage,
  baseParDefaut,
  caracteristiquesAuChoix,
  NOMS_CARACTERISTIQUES,
  pointsDepenses,
  scoresAchat,
  verifierBase,
  verifierChoixBonus,
} from "@partage/creation.js";
import { CARACTERISTIQUES } from "@partage/dnd5e.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone } from "@/core/medias";
import type { Caracteristique, Classe, MethodeCaracteristiques, Race, Referentiel } from "@/core/types";
import { avecInfobulle, CoucheInfobulle } from "@/ui/InfoBulle";

type Base = Record<Caracteristique, number>;
const CARACS = CARACTERISTIQUES as readonly Caracteristique[];
const abreviation = (c: Caracteristique) => NOMS_CARACTERISTIQUES[c].slice(0, 3).toUpperCase();
const signe = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * Ecran de creation de personnage, facon World of Warcraft.
 *
 *   gauche : Loyaute (Alliance / Horde) puis Race
 *   centre : le portrait 2D (images du dossier portraits/ de ton cloud)
 *   droite : Classe, puis caracteristiques et valeurs calculees
 *   bas    : nom du personnage et "Entrer dans le monde"
 *
 * Tout ce qui est propose vient du REFERENTIEL (fichiers JSON du MJ). Les
 * calculs affiches sont ceux de shared/creation.js, le code meme qu'utilise
 * le serveur pour verifier : l'apercu ne peut pas mentir.
 */
export function EcranCreation() {
  const referentiel = useJeu((e) => e.referentiel);
  if (!referentiel?.races.length || !referentiel.classes.length) {
    return (
      <div className="ecran-accueil">
        <div className="accueil cadre">
          <h1 className="titre-or accueil__titre">Creation impossible</h1>
          <p className="accueil__sous-titre">
            {referentiel ? "Le referentiel ne contient aucune race ou aucune classe valide : previens le MJ." : "Chargement..."}
          </p>
          <button className="bouton" type="button" onClick={() => jeu.quitterTable()}>
            Retour
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      <Creation referentiel={referentiel} />
      <CoucheInfobulle />
    </>
  );
}

function Creation({ referentiel }: { referentiel: Referentiel }) {
  const table = useJeu((e) => e.table);
  const regles = referentiel.creation;

  // --- Les choix du joueur (etat local de l'ecran) --------------------------------------
  const [idFaction, setIdFaction] = useState(referentiel.factions[0]?.id ?? "");
  const racesDeLaFaction = referentiel.races.filter((r) => r.factions.includes(idFaction));
  const [idRace, setIdRace] = useState(racesDeLaFaction[0]?.id ?? "");
  const race = referentiel.races.find((r) => r.id === idRace) ?? racesDeLaFaction[0];
  const [idClasse, setIdClasse] = useState(race?.classesPermises[0] ?? "");
  const classe = referentiel.classes.find((c) => c.id === idClasse);
  const [methode, setMethode] = useState<MethodeCaracteristiques>(regles.methodes[0]);
  const [base, setBase] = useState<Base>(() => baseParDefaut(regles.methodes[0], regles, classe?.caracteristiquesPrincipales));
  const [baseModifiee, setBaseModifiee] = useState(false);
  const [bonusAuChoix, setBonusAuChoix] = useState<Caracteristique[]>([]);
  const [nom, setNom] = useState("");
  const [portraits, setPortraits] = useState<string[]>([]);
  const [indexPortrait, setIndexPortrait] = useState(0);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Les images du dossier portraits/ (le serveur en donne la liste).
  useEffect(() => {
    jeu.demander(EVENEMENTS.PORTRAITS_LISTER).then((r) => r.ok && setPortraits(r.fichiers as string[]));
  }, []);

  // --- Enchainement des choix (comme dans WoW : faction -> race -> classe) ---------------
  const choisirFaction = (id: string) => {
    setIdFaction(id);
    // Une race des deux camps (Pandaren...) reste choisie ; sinon, la premiere race du camp.
    if (race?.factions.includes(id)) return;
    const premiere = referentiel.races.find((r) => r.factions.includes(id));
    if (premiere) choisirRace(premiere);
  };
  const choisirRace = (r: Race) => {
    setIdRace(r.id);
    setBonusAuChoix([]);
    setIndexPortrait(0);
    if (!r.classesPermises.includes(idClasse) && r.classesPermises[0]) choisirClasse(r.classesPermises[0]);
  };
  const choisirClasse = (id: string) => {
    setIdClasse(id);
    // Tant que le joueur n'a rien touche, le tableau standard suit la classe
    // (meilleures valeurs sur ses caracteristiques principales).
    const nouvelle = referentiel.classes.find((c) => c.id === id);
    if (!baseModifiee && methode === "tableau-standard") setBase(baseParDefaut(methode, regles, nouvelle?.caracteristiquesPrincipales));
  };
  const choisirMethode = (m: MethodeCaracteristiques) => {
    setMethode(m);
    setBaseModifiee(false);
    setBase(baseParDefaut(m, regles, classe?.caracteristiquesPrincipales));
  };
  const changerScore = (c: Caracteristique, valeur: number) => {
    setBaseModifiee(true);
    setBase((actuelle) => {
      const suite = { ...actuelle, [c]: valeur };
      // Tableau standard : chaque valeur ne sert qu'une fois, on ECHANGE avec la caracteristique qui l'avait.
      if (methode === "tableau-standard") {
        const autre = CARACS.find((x) => x !== c && actuelle[x] === valeur);
        if (autre) suite[autre] = actuelle[c];
      }
      return suite;
    });
  };

  // --- Apercu calcule (memes fonctions que le serveur) -----------------------------------
  const apercu = useMemo(
    () => (race && classe ? apercuPersonnage({ race, classe, base, bonusAuChoix }, referentiel) : null),
    [race, classe, base, bonusAuChoix, referentiel],
  );
  const portraitsDeLaRace = race ? portraits.filter((f) => f.toLowerCase().startsWith(`${race.id}-`) || f.toLowerCase().startsWith(`${race.id}.`)) : [];
  const portrait = portraitsDeLaRace.length ? portraitsDeLaRace[indexPortrait % portraitsDeLaRace.length] : null;
  const probleme =
    !race || !classe
      ? "Choisis une race et une classe."
      : (verifierBase(methode, base, regles) ?? verifierChoixBonus(race, bonusAuChoix) ?? (nom.trim().length < 2 ? "Donne un nom a ton personnage." : null));

  const entrer = async (e: FormEvent) => {
    e.preventDefault();
    if (probleme || !race || !classe) return setErreur(probleme ?? "");
    setEnvoi(true);
    setErreur("");
    const r = await jeu.creerPersonnage({
      nom: nom.trim(),
      faction: idFaction,
      race: race.id,
      classe: classe.id,
      methode,
      caracteristiques: base,
      bonusAuChoix,
      portrait,
    });
    // En cas de succes, le magasin bascule tout seul sur l'ecran de jeu.
    if (!r.ok) {
      setErreur(r.erreur ?? "Refus du serveur.");
      setEnvoi(false);
    }
  };

  const faction = referentiel.factions.find((f) => f.id === idFaction);
  return (
    <form className="creation" style={{ "--couleur-faction": faction?.couleur ?? "#ffd100" } as CSSProperties} onSubmit={entrer}>
      {/* ===== Gauche : loyaute et race ===== */}
      <section className="creation__colonne cadre">
        <h2 className="creation__titre titre-or">Loyaute</h2>
        <div className="creation__factions">
          {referentiel.factions.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`banniere${f.id === idFaction ? " banniere--active" : ""}`}
              style={{ "--couleur": f.couleur } as CSSProperties}
              onClick={() => choisirFaction(f.id)}
              {...avecInfobulle(() => (
                <>
                  <div className="infobulle__titre">{f.nom}</div>
                  <div className="infobulle__ligne--or">{f.description}</div>
                </>
              ))}
            >
              <Image src={urlIcone(f.embleme)} texte={f.nom.slice(0, 1)} classe="banniere__embleme" />
              <span className="banniere__nom">{f.nom}</span>
            </button>
          ))}
        </div>

        <h2 className="creation__titre titre-or">Race</h2>
        <div className="grille-choix grille-choix--races">
          {racesDeLaFaction.map((r) => (
            <BoutonChoix key={r.id} nom={r.nom} icone={r.icone} actif={r.id === race?.id} onClick={() => choisirRace(r)} aide={<AideRace race={r} />} />
          ))}
        </div>

        {race && (
          <div className="creation__description">
            <h3>{race.nom}</h3>
            <p>{race.description}</p>
            <p>
              <b>Bonus :</b> {BonusTexte(race)} - <b>Vitesse :</b> {race.vitesse.toLocaleString("fr-FR")} m
              {race.pvParNiveau ? ` - +${race.pvParNiveau} PV par niveau` : ""}
            </p>
            {race.traits.map((t) => (
              <p key={t.nom}>
                <b>{t.nom}.</b> {t.description}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* ===== Centre : le portrait ===== */}
      <section className="creation__centre">
        <div className="creation__entete">
          <div className="creation__table">{table?.nom}</div>
          <div className="titre-or creation__resume">
            {race?.nom} <span style={{ color: classe?.couleur }}>{classe?.nom}</span>
          </div>
        </div>
        <div className="creation__portrait">
          {portrait ? (
            <img src={`/medias/portraits/${encodeURIComponent(portrait)}`} alt={`Portrait ${race?.nom}`} />
          ) : (
            <div className="creation__portrait-vide">
              <Image src={race ? urlIcone(race.icone) : ""} texte={race?.nom.slice(0, 2) ?? "?"} classe="creation__portrait-icone" />
              <p>
                Aucun portrait pour cette race.
                <br />
                Ajoute des images <code>portraits/{race?.id}-1.png</code>, <code>{race?.id}-2.png</code>... dans ton dossier.
              </p>
            </div>
          )}
          {portraitsDeLaRace.length > 1 && (
            <>
              <button type="button" className="creation__fleche creation__fleche--gauche" aria-label="Portrait precedent" onClick={() => setIndexPortrait((i) => i + portraitsDeLaRace.length - 1)}>
                ‹
              </button>
              <button type="button" className="creation__fleche creation__fleche--droite" aria-label="Portrait suivant" onClick={() => setIndexPortrait((i) => i + 1)}>
                ›
              </button>
            </>
          )}
        </div>
      </section>

      {/* ===== Droite : classe et caracteristiques ===== */}
      <section className="creation__colonne cadre">
        <h2 className="creation__titre titre-or">Classe</h2>
        <div className="grille-choix grille-choix--classes">
          {referentiel.classes.map((c) => {
            const permise = race?.classesPermises.includes(c.id) ?? false;
            return (
              <BoutonChoix
                key={c.id}
                nom={c.nom}
                icone={c.icone}
                couleur={c.couleur}
                actif={c.id === classe?.id}
                interdit={!permise}
                onClick={() => permise && choisirClasse(c.id)}
                aide={<AideClasse classe={c} race={race} permise={permise} referentiel={referentiel} />}
              />
            );
          })}
        </div>

        {classe && (
          <p className="creation__classe-info">
            <b style={{ color: classe.couleur }}>{classe.nom}</b>
            {classe.equivalentDnd ? ` (${classe.equivalentDnd} de D&D)` : ""} - de de vie d{classe.deDeVie} - {classe.description}
          </p>
        )}

        <h2 className="creation__titre titre-or">Caracteristiques</h2>
        {regles.methodes.length > 1 && (
          <div className="creation__methodes">
            {regles.methodes.map((m) => (
              <button key={m} type="button" className={`onglet${m === methode ? " onglet--actif" : ""}`} onClick={() => choisirMethode(m)}>
                {m === "tableau-standard" ? "Tableau standard" : "Achat de points"}
              </button>
            ))}
          </div>
        )}
        {methode === "achat-de-points" && (
          <div className={`creation__points${pointsDepenses(base, regles) > regles.achatDePoints.budget ? " creation__points--depasse" : ""}`}>
            Points depenses : {pointsDepenses(base, regles)} / {regles.achatDePoints.budget}
          </div>
        )}
        {race?.bonusAuChoix && <ChoixBonus race={race} choix={bonusAuChoix} surChoix={setBonusAuChoix} />}

        {apercu && (
          <table className="caracs">
            <thead>
              <tr>
                <th></th>
                <th>Base</th>
                <th>Race</th>
                <th>Total</th>
                <th>Mod.</th>
              </tr>
            </thead>
            <tbody>
              {CARACS.map((c) => (
                <tr key={c} className={classe?.caracteristiquesPrincipales.includes(c) ? "caracs__principale" : undefined}>
                  <th>{NOMS_CARACTERISTIQUES[c]}</th>
                  <td>
                    <ScoreDeBase carac={c} methode={methode} base={base} regles={regles} surChange={(v) => changerScore(c, v)} />
                  </td>
                  <td className="caracs__bonus">{apercu.bonus[c] ? signe(apercu.bonus[c]) : ""}</td>
                  <td className="caracs__total">{apercu.caracteristiques[c]}</td>
                  <td>{signe(apercu.modificateurs[c])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {apercu && (
          <div className="creation__derives">
            <span>
              <b>PV</b> {apercu.pvMax}
            </span>
            <span>
              <b>CA</b> {apercu.classeArmure}
            </span>
            <span>
              <b>Vitesse</b> {apercu.vitesse.toLocaleString("fr-FR")} m
            </span>
            {apercu.ressources.map((r: { cle: string; nom: string; max: number }) => (
              <span key={r.cle} style={{ color: referentiel.ressources.find((m) => m.id === r.cle)?.couleur }}>
                {r.nom} {r.max}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ===== Bas : nom et entree dans le monde ===== */}
      <footer className="creation__pied">
        <button type="button" className="bouton creation__retour" onClick={() => jeu.quitterTable()}>
          Retour
        </button>
        <div className="creation__validation">
          <input className="champ creation__nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du personnage" maxLength={24} aria-label="Nom du personnage" />
          <button className="bouton creation__entrer" type="submit" disabled={envoi || !!probleme} title={probleme ?? ""}>
            {envoi ? "Entree..." : "Entrer dans le monde"}
          </button>
          <div className="creation__erreur">{erreur || (nom.trim().length >= 2 ? (probleme ?? "") : "")}</div>
        </div>
      </footer>
    </form>
  );
}

// --- Briques de l'ecran ---------------------------------------------------------------------

/** Image du dossier icones/ ; si elle manque, une pastille avec des initiales. */
function Image({ src, texte, classe }: { src: string; texte: string; classe: string }) {
  const [absente, setAbsente] = useState(false);
  useEffect(() => setAbsente(false), [src]);
  if (absente || !src) return <span className={`${classe} image-absente`}>{texte.toUpperCase()}</span>;
  return <img className={classe} src={`${src}?remplacement=non`} alt="" onError={() => setAbsente(true)} />;
}

function BoutonChoix(props: { nom: string; icone: string; couleur?: string; actif: boolean; interdit?: boolean; onClick: () => void; aide: React.ReactNode }) {
  const { nom, icone, couleur, actif, interdit, onClick, aide } = props;
  return (
    <button
      type="button"
      className={`choix${actif ? " choix--actif" : ""}${interdit ? " choix--interdit" : ""}`}
      style={couleur ? ({ "--couleur": couleur } as CSSProperties) : undefined}
      onClick={onClick}
      aria-pressed={actif}
      aria-disabled={interdit}
      {...avecInfobulle(() => aide)}
    >
      <Image src={urlIcone(icone)} texte={nom.slice(0, 2)} classe="choix__icone" />
      <span className="choix__nom">{nom}</span>
    </button>
  );
}

function BonusTexte(race: Race) {
  const fixes = Object.entries(race.bonusCaracteristiques)
    .filter(([, v]) => v)
    .map(([c, v]) => `${abreviation(c as Caracteristique)} ${signe(v as number)}`);
  if (race.bonusAuChoix) fixes.push(`${race.bonusAuChoix.bonus.map(signe).join(" / ")} au choix`);
  return fixes.join(", ") || "aucun";
}

function AideRace({ race }: { race: Race }) {
  return (
    <>
      <div className="infobulle__titre">{race.nom}</div>
      <div>Bonus : {BonusTexte(race)}</div>
      <div className="infobulle__ligne--or">{race.description}</div>
    </>
  );
}

function AideClasse({ classe, race, permise, referentiel }: { classe: Classe; race?: Race; permise: boolean; referentiel: Referentiel }) {
  // Pourquoi une classe est grisee : les races qui y ont acces (d'apres races.json).
  const races = referentiel.races.filter((r) => r.classesPermises.includes(classe.id)).map((r) => r.nom);
  return (
    <>
      <div className="infobulle__titre" style={{ color: classe.couleur }}>
        {classe.nom}
      </div>
      <div>De de vie : d{classe.deDeVie}</div>
      <div className="infobulle__ligne--or">{classe.description}</div>
      {!permise && (
        <div className="infobulle__ligne--rouge">
          Indisponible pour : {race?.nom}. Races possibles : {races.join(", ") || "aucune"}.
        </div>
      )}
    </>
  );
}

/** Le score de BASE d'une caracteristique : liste du tableau standard, ou boutons - / + (achat). */
function ScoreDeBase(props: { carac: Caracteristique; methode: MethodeCaracteristiques; base: Base; regles: Referentiel["creation"]; surChange: (v: number) => void }) {
  const { carac, methode, base, regles, surChange } = props;
  const valeur = base[carac];
  if (methode === "tableau-standard") {
    return (
      <select className="caracs__liste" value={valeur} onChange={(e) => surChange(Number(e.target.value))}>
        {[...regles.tableauStandard]
          .sort((a, b) => b - a)
          .map((v, i) => (
            <option key={`${v}-${i}`} value={v}>
              {v}
            </option>
          ))}
      </select>
    );
  }
  const scores = scoresAchat(regles);
  const suivant = valeur + 1;
  // "+" grise si le score suivant n'existe pas ou si le budget ne suffit plus.
  const tropCher = !(suivant in regles.achatDePoints.couts) || pointsDepenses({ ...base, [carac]: suivant }, regles) > regles.achatDePoints.budget;
  return (
    <span className="caracs__achat">
      <button type="button" disabled={valeur <= scores[0]} onClick={() => surChange(valeur - 1)} aria-label="Baisser">
        −
      </button>
      <b>{valeur}</b>
      <button type="button" disabled={tropCher} onClick={() => surChange(suivant)} aria-label="Augmenter">
        +
      </button>
    </span>
  );
}

/** Bonus de race "au choix" (regles 2024) : une caracteristique par bonus. */
function ChoixBonus({ race, choix, surChoix }: { race: Race; choix: Caracteristique[]; surChoix: (c: Caracteristique[]) => void }) {
  const permises = caracteristiquesAuChoix(race) as Caracteristique[];
  return (
    <div className="creation__bonus-choix">
      {race.bonusAuChoix!.bonus.map((valeur, i) => (
        <label key={i}>
          Bonus {signe(valeur)} :{" "}
          <select
            value={choix[i] ?? ""}
            onChange={(e) => {
              const suite = [...choix];
              suite[i] = e.target.value as Caracteristique;
              surChoix(suite);
            }}
          >
            <option value="">-</option>
            {permises
              .filter((c) => c === choix[i] || !choix.includes(c))
              .map((c) => (
                <option key={c} value={c}>
                  {NOMS_CARACTERISTIQUES[c]}
                </option>
              ))}
          </select>
        </label>
      ))}
    </div>
  );
}
