import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  apercuPersonnage,
  baseParDefaut,
  caracteristiquesAuChoix,
  choixPossibles,
  choixRetenus,
  detailsOrigine,
  methodesDeLaTable,
  valeursARepartir,
  NOMS_CARACTERISTIQUES,
  pointsDepenses,
  raceDisponible,
  repartitionParDefaut,
  restrictionDeLore,
  scoresAchat,
  verifierBase,
  verifierChoixBonus,
  verifierOptions,
  verifierRepartitionHistorique,
} from "@partage/creation.js";
import { CARACTERISTIQUES } from "@partage/dnd5e.js";
import { EVENEMENTS } from "@partage/protocole.js";
import { useTextures, type RoleTexture } from "@/core/textures";
import { jeu, useJeu } from "@/core/jeu";
import { urlIcone } from "@/core/medias";
import type { AnnonceTirage, Caracteristique, ChoixOption, Classe, Historique, MethodeCaracteristiques, Race, Referentiel, Table, TirageCreation } from "@/core/types";
import { AnimationTirage } from "./AnimationTirage";
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
  const textures = useTextures(); // icones de classe de WoW (dossier interface/), en secours
  const regles = referentiel.creation;
  // Le MJ autorise-t-il le lore libre a cette table ? (bouton de sa barre d'outils)
  const loreAutorise = Boolean(table?.reglages?.loreLibre);
  // Les methodes de caracteristiques que le MJ permet a cette table.
  const methodes = methodesDeLaTable(regles, table?.reglages) as MethodeCaracteristiques[];
  // Mon tirage aux des, garde par le serveur (le meilleur, apres une relance).
  const monPseudo = useJeu((e) => e.profil?.pseudo ?? "");
  const monTirage = Object.values(table?.tirages ?? {}).find((t) => t.pseudo.toLocaleLowerCase("fr") === monPseudo.toLocaleLowerCase("fr")) ?? null;
  const valeursTirage = monTirage ? monTirage.tirages[monTirage.retenu] : null;
  const cleTirage = valeursTirage?.join(",") ?? "";

  // --- Les choix du joueur (etat local de l'ecran) --------------------------------------
  const [ignorerLore, setIgnorerLore] = useState(false);
  const lore = (ignorerLore && loreAutorise) || !regles.restrictionsRaceClasse; // true = restrictions levees
  const [idFaction, setIdFaction] = useState(referentiel.factions[0]?.id ?? "");
  const racesDeLaFaction = referentiel.races.filter((r) => raceDisponible(r, idFaction, lore));
  const [idRace, setIdRace] = useState(racesDeLaFaction[0]?.id ?? "");
  const race = referentiel.races.find((r) => r.id === idRace) ?? racesDeLaFaction[0];
  const [options, setOptions] = useState<Record<string, string>>(() => (race ? optionsParDefaut(race, idFaction, lore) : {}));
  // L'image d'un peuple dans la grille suit sa lignee : choix en cours pour le
  // peuple selectionne, sinon le premier choix possible dans la faction
  // (ex. Elfe cote Horde = elfe de sang, cote Alliance = elfe de la nuit).
  const apparenceAffichee = (r: Race) =>
    detailsOrigine(r, undefined, r.id === race?.id ? options : optionsParDefaut(r, idFaction, lore)).apparence as string;
  // Par defaut, une classe de base (les classes heroiques se prennent normalement au niveau 3).
  const [idClasse, setIdClasse] = useState((referentiel.classes.find((c) => !c.heroique) ?? referentiel.classes[0])?.id ?? "");
  const classe = referentiel.classes.find((c) => c.id === idClasse);
  const [idSpecialisation, setIdSpecialisation] = useState<string | null>(classe?.specialisations[0]?.id ?? null);
  const [sexe, setSexe] = useState<"masculin" | "feminin">("masculin");
  const [idHistorique, setIdHistorique] = useState<string | null>(referentiel.historiques[0]?.id ?? null);
  const historique = referentiel.historiques.find((h) => h.id === idHistorique) ?? null;
  const [repartition, setRepartition] = useState<Partial<Record<Caracteristique, number>>>(() =>
    repartitionParDefaut(historique, classe?.caracteristiquesPrincipales),
  );
  const [repartitionModifiee, setRepartitionModifiee] = useState(false);
  const [donSupplementaire, setDonSupplementaire] = useState<string | null>(null);
  const [methode, setMethode] = useState<MethodeCaracteristiques>(methodes[0]);
  const [base, setBase] = useState<Base>(() => baseParDefaut(methodes[0], regles, classe?.caracteristiquesPrincipales, valeursTirage));
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

  // Dons d'origine proposes en plus (Humain) : ceux du referentiel, sauf celui de l'historique.
  const donsSupplementaires = race?.donOrigineSupplementaire
    ? referentiel.dons.filter((d) => d.categorie === "origine" && (!d.races || d.races.includes(race.id)) && d.id !== historique?.donOrigine)
    : [];
  // Un don choisi qui n'est plus proposable (autre race, autre historique) : on le retire.
  useEffect(() => {
    if (!donsSupplementaires.length) setDonSupplementaire(null);
    else if (!donsSupplementaires.some((d) => d.id === donSupplementaire)) setDonSupplementaire(donsSupplementaires[0].id);
  }, [race?.id, historique?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Enchainement des choix (comme dans WoW : faction -> race -> classe) ---------------
  const choisirFaction = (id: string) => {
    setIdFaction(id);
    // Une race des deux camps (Pandaren, Elfe...) reste choisie ; ses choix sont revus.
    if (race && raceDisponible(race, id, lore)) return setOptions((o) => ajusterOptions(race, o, id, lore));
    const premiere = referentiel.races.find((r) => raceDisponible(r, id, lore));
    if (premiere) choisirRace(premiere, id);
  };
  const choisirRace = (r: Race, faction = idFaction) => {
    setIdRace(r.id);
    setOptions(optionsParDefaut(r, faction, lore));
    setBonusAuChoix([]);
    setIndexPortrait(0);
  };
  const choisirOption = (idOption: string, idChoix: string) => {
    setOptions((o) => ({ ...o, [idOption]: idChoix }));
    setIndexPortrait(0);
  };
  const choisirClasse = (id: string) => {
    setIdClasse(id);
    const nouvelle = referentiel.classes.find((c) => c.id === id);
    setIdSpecialisation(nouvelle?.specialisations[0]?.id ?? null);
    // Tant que le joueur n'a rien touche, le tableau standard et les bonus d'historique
    // suivent la classe (meilleures valeurs sur ses caracteristiques principales).
    if (!baseModifiee && methode !== "achat-de-points") setBase(baseParDefaut(methode, regles, nouvelle?.caracteristiquesPrincipales, valeursTirage));
    if (!repartitionModifiee) setRepartition(repartitionParDefaut(historique, nouvelle?.caracteristiquesPrincipales));
  };
  const choisirHistorique = (id: string) => {
    setIdHistorique(id);
    setRepartitionModifiee(false);
    setRepartition(repartitionParDefaut(referentiel.historiques.find((h) => h.id === id), classe?.caracteristiquesPrincipales));
  };
  const changerRepartition = (r: Partial<Record<Caracteristique, number>>) => {
    setRepartitionModifiee(true);
    setRepartition(r);
  };
  const changerLore = (actif: boolean) => {
    setIgnorerLore(actif);
    // On revient au lore : la race et ses choix doivent redevenir conformes.
    if (!actif && race && !raceDisponible(race, idFaction, false)) {
      const premiere = referentiel.races.find((r) => raceDisponible(r, idFaction, false));
      if (premiere) choisirRace(premiere);
    } else if (!actif && race) setOptions((o) => ajusterOptions(race, o, idFaction, false));
  };
  const choisirMethode = (m: MethodeCaracteristiques) => {
    setMethode(m);
    setBaseModifiee(false);
    setBase(baseParDefaut(m, regles, classe?.caracteristiquesPrincipales, valeursTirage));
  };
  // Le MJ retire la methode en cours : on passe a une methode permise.
  useEffect(() => {
    if (!methodes.includes(methode)) choisirMethode(methodes[0]);
  }, [methodes.join(","), methode]);
  // Nouveau tirage (ou relance gardee) : les valeurs sont replacees.
  useEffect(() => {
    if (methode === "tirage-4d6") choisirMethode("tirage-4d6");
  }, [cleTirage]);
  const [tirageEnCours, setTirageEnCours] = useState(false);
  const [animation, setAnimation] = useState<AnnonceTirage | null>(null); // le tirage qui roule a l'ecran
  const tirerDes = async () => {
    setTirageEnCours(true);
    setErreur("");
    const r = await jeu.demander(EVENEMENTS.CREATION_TIRER, {});
    if (r.ok && r.table) jeu.modifier({ table: r.table as Table });
    if (r.ok && r.tirage) setAnimation(r.tirage as AnnonceTirage);
    if (!r.ok) setErreur(r.erreur ?? "Refus du serveur.");
    setTirageEnCours(false);
  };
  const changerScore = (c: Caracteristique, valeur: number) => {
    setBaseModifiee(true);
    setBase((actuelle) => {
      const suite = { ...actuelle, [c]: valeur };
      // Tableau standard ou tirage : chaque valeur ne sert qu'une fois, on ECHANGE avec la caracteristique qui l'avait.
      if (methode !== "achat-de-points") {
        const autre = CARACS.find((x) => x !== c && actuelle[x] === valeur);
        if (autre) suite[autre] = actuelle[c];
      }
      return suite;
    });
  };

  // --- Apercu calcule (memes fonctions que le serveur) -----------------------------------
  const apercu = useMemo(
    () => (race && classe ? apercuPersonnage({ race, classe, base, bonusAuChoix, repartition, choixOptions: options }, referentiel) : null),
    [race, classe, base, bonusAuChoix, repartition, options, referentiel],
  );
  const loreClasse = (c: Classe) => (lore || !race ? null : (restrictionDeLore(c, race, options) as string | null));
  const apparence: string = apercu?.apparence ?? race?.id ?? "";
  const portraitsDeLaRace = apparence ? portraits.filter((f) => f.toLowerCase().startsWith(`${apparence}-`) || f.toLowerCase().startsWith(`${apparence}.`)) : [];
  const portrait = portraitsDeLaRace.length ? portraitsDeLaRace[indexPortrait % portraitsDeLaRace.length] : null;
  const probleme =
    !race || !classe
      ? "Choisis une race et une classe."
      : (verifierOptions(race, options, idFaction, lore) ??
        loreClasse(classe) ??
        (referentiel.historiques.length ? verifierRepartitionHistorique(historique, repartition) : null) ??
        (classe.specialisations.length && !idSpecialisation ? "Choisis une specialisation." : null) ??
        (race.donOrigineSupplementaire && !donSupplementaire ? "Choisis ton don d'origine supplementaire." : null) ??
        verifierBase(methode, base, regles, { methodes, valeursTirage }) ??
        verifierChoixBonus(race, bonusAuChoix) ??
        (nom.trim().length < 2 ? "Donne un nom a ton personnage." : null));

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
      sexe,
      historique: historique?.id ?? null,
      repartition: historique ? repartition : {},
      options,
      specialisation: classe.specialisations.length ? idSpecialisation : null,
      donSupplementaire: race.donOrigineSupplementaire ? donSupplementaire : null,
      ignorerLore: ignorerLore && loreAutorise,
    });
    // En cas de succes, le magasin bascule tout seul sur l'ecran de jeu.
    if (!r.ok) {
      setErreur(r.erreur ?? "Refus du serveur.");
      setEnvoi(false);
    }
  };

  const faction = referentiel.factions.find((f) => f.id === idFaction);
  // Fond de l'ecran : la capitale de la faction (Hurlevents, Orgrimmar) si elle est dans interface/.
  const fond = textures[`fond-${idFaction}`];
  // Portrait provisoire de WoW pour l'apparence (race ou lignee) et le sexe choisis.
  const portraitWow = apparence ? (textures[`portrait-${apparence}-${sexe}`] ?? (race ? textures[`portrait-${race.id}-${sexe}`] : undefined)) : undefined;
  const specialisation = classe?.specialisations.find((s) => s.id === idSpecialisation);
  return (
    <form
      className={`creation${fond ? " creation--fond" : ""}`}
      style={{ "--couleur-faction": faction?.couleur ?? "#ffd100", ...(fond ? { "--fond-faction": `url("${fond}")` } : {}) } as CSSProperties}
      onSubmit={entrer}
    >
      {/* ===== Gauche : loyaute, race et ses choix ===== */}
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
              <Image src={urlIcone(f.embleme)} texte={f.nom.slice(0, 1)} classe="banniere__embleme" secours={textures[`logo-${f.id}`]} />
              <span className="banniere__nom">{f.nom}</span>
            </button>
          ))}
        </div>
        {loreAutorise && regles.restrictionsRaceClasse && (
          <label className="creation__lore" title="Le MJ autorise a cette table les combinaisons hors lore (ex. un evocateur qui n'est pas dracthyr).">
            <input type="checkbox" checked={ignorerLore} onChange={(e) => changerLore(e.target.checked)} /> Ignorer les restrictions de lore
          </label>
        )}

        <h2 className="creation__titre titre-or">Race</h2>
        <div className="grille-choix grille-choix--races">
          {racesDeLaFaction.map((r) => (
            <BoutonChoix
              key={r.id}
              nom={r.nom}
              icone={r.icone}
              actif={r.id === race?.id}
              onClick={() => choisirRace(r)}
              aide={<AideRace race={r} />}
              secours={textures[`portrait-${apparenceAffichee(r)}-${sexe}`] ?? textures[`portrait-${r.id}-${sexe}`]}
            />
          ))}
        </div>

        {/* Le sexe du personnage : il choisit le portrait provisoire de WoW (race + sexe). */}
        <div className="creation__sexe" role="radiogroup" aria-label="Sexe">
          {(
            [
              ["masculin", "Masculin", "♂"],
              ["feminin", "Feminin", "♀"],
            ] as const
          ).map(([valeur, nomSexe, symbole]) => (
            <button
              key={valeur}
              type="button"
              role="radio"
              aria-checked={sexe === valeur}
              className={`creation__sexe-bouton${sexe === valeur ? " creation__sexe-bouton--actif" : ""}`}
              onClick={() => setSexe(valeur)}
            >
              {textures[`sexe-${valeur}`] ? (
                <img className="creation__sexe-icone" src={textures[`sexe-${valeur}`]} alt="" />
              ) : (
                <span aria-hidden="true">{symbole}</span>
              )}{" "}
              {nomSexe}
            </button>
          ))}
        </div>

        {race && race.options.length > 0 && (
          <div className="creation__options">
            {race.options.map((option) => (
              <label key={option.id} className="creation__option" title={option.description || undefined}>
                <span>{option.nom}</span>
                <select className="champ" value={options[option.id] ?? ""} onChange={(e) => choisirOption(option.id, e.target.value)}>
                  {choixPossibles(option, idFaction, lore).map((c: ChoixOption) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {race && apercu && (
          <div className="creation__description">
            <h3>{race.nom}</h3>
            <p>{race.description}</p>
            <p>
              <b>Type :</b> {apercu.typeCreature} - <b>Taille :</b> {apercu.taille} - <b>Vitesse :</b> {race.vitesse.toLocaleString("fr-FR")} m
              {race.pvParNiveau ? ` - +${race.pvParNiveau} PV par niveau` : ""}
              {BonusTexte(race) ? ` - Bonus : ${BonusTexte(race)}` : ""}
            </p>
            {apercu.renommee && (
              <p>
                <b>Renommee de depart :</b> {apercu.renommee.faction} ({apercu.renommee.valeur})
              </p>
            )}
            {choixRetenus(race, options)
              .filter((c: ChoixOption) => c.description)
              .map((c: ChoixOption) => (
                <p key={c.id}>
                  <b>{c.nom}.</b> {c.description}
                </p>
              ))}
            {apercu.traits.map((t: { nom: string; description: string }) => (
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
            {specialisation ? <span className="creation__resume-spe"> - {specialisation.nom}</span> : null}
          </div>
        </div>
        <div className="creation__portrait">
          {portrait ? (
            <img src={`/medias/portraits/${encodeURIComponent(portrait)}`} alt={`Portrait ${race?.nom}`} />
          ) : portraitWow ? (
            <div className="creation__portrait-vide">
              <img className="creation__portrait-wow" src={portraitWow} alt={`Portrait ${race?.nom}`} />
              <p>
                Portrait provisoire. Pour le tien : <code>portraits/{apparence}-1.png</code>...
              </p>
            </div>
          ) : (
            <div className="creation__portrait-vide">
              <Image src={race ? urlIcone(race.icone) : ""} texte={race?.nom.slice(0, 2) ?? "?"} classe="creation__portrait-icone" />
              <p>
                Aucun portrait pour cette race.
                <br />
                Ajoute des images <code>portraits/{apparence}-1.png</code>, <code>{apparence}-2.png</code>... dans ton dossier.
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

      {/* ===== Droite : classe, historique et caracteristiques ===== */}
      {/* Le contenu defile s'il manque de place (petit ecran, Humain et son don en plus) ;
          le cadre, lui, ne bouge pas (ses rivets ne sont pas coupes). */}
      <section className="creation__colonne cadre">
        <div className="creation__defilant">
        <h2 className="creation__titre titre-or">Classe</h2>
        <div className="grille-choix grille-choix--classes">
          {referentiel.classes.map((c) => {
            const horsLore = loreClasse(c);
            return (
              <BoutonChoix
                key={c.id}
                nom={c.nom}
                icone={c.icone}
                couleur={c.couleur}
                actif={c.id === classe?.id}
                interdit={Boolean(horsLore)}
                onClick={() => !horsLore && choisirClasse(c.id)}
                aide={<AideClasse classe={c} horsLore={horsLore} />}
                secours={textures[`classe-${c.id}` as RoleTexture]}
              />
            );
          })}
        </div>

        {classe && (
          <p className="creation__classe-info">
            <b style={{ color: classe.couleur }}>{classe.nom}</b>
            {classe.heroique && <span className="creation__heroique"> - classe heroique</span>}
            {classe.classeDnd ? ` (${classe.classeDnd} du Manuel des joueurs)` : ""} - de de vie d{classe.deDeVie} - {classe.description}
            {classe.heroique && " Normalement accessible a partir du niveau 3 : vois avec ton MJ."}
            {classe.sousClasseCreation ? ` Sous-classe des la creation : ${classe.sousClasseCreation}.` : ""}
          </p>
        )}
        {classe && classe.specialisations.length > 0 && (
          <label className="creation__option">
            <span>Specialisation</span>
            <select className="champ" value={idSpecialisation ?? ""} onChange={(e) => setIdSpecialisation(e.target.value)}>
              {classe.specialisations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </label>
        )}
        {specialisation && (
          <p className="creation__classe-info">
            {specialisation.description}
            {specialisation.sousClasse ? ` Sous-classe conseillee au niveau 3 : ${specialisation.sousClasse}.` : ""}
          </p>
        )}

        {referentiel.historiques.length > 0 && (
          <>
            <h2 className="creation__titre titre-or">Historique</h2>
            <label className="creation__option">
              <span>Historique</span>
              <select className="champ" value={idHistorique ?? ""} onChange={(e) => choisirHistorique(e.target.value)}>
                {referentiel.historiques.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nom}
                  </option>
                ))}
              </select>
            </label>
            {historique && (
              <>
                <p className="creation__classe-info">
                  {historique.description} Don d'origine : <b>{referentiel.dons.find((d) => d.id === historique.donOrigine)?.nom ?? historique.donOrigine}</b>
                  {historique.competences.length ? ` - Competences : ${historique.competences.join(", ")}` : ""}
                  {historique.outil ? ` - Outil : ${historique.outil}` : ""}.
                </p>
                <ChoixRepartition historique={historique} repartition={repartition} surChange={changerRepartition} />
              </>
            )}
            {race?.donOrigineSupplementaire && (
              <label className="creation__option" title={referentiel.dons.find((d) => d.id === donSupplementaire)?.description}>
                <span>Don d'origine ({race.nom})</span>
                <select className="champ" value={donSupplementaire ?? ""} onChange={(e) => setDonSupplementaire(e.target.value)}>
                  {donsSupplementaires.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        <h2 className="creation__titre titre-or">Caracteristiques</h2>
        {methodes.length > 1 && (
          <div className="creation__methodes">
            {methodes.map((m) => (
              <button key={m} type="button" className={`onglet${m === methode ? " onglet--actif" : ""}`} onClick={() => choisirMethode(m)}>
                {NOMS_METHODES[m]}
              </button>
            ))}
          </div>
        )}
        {methode === "tirage-4d6" && <PanneauTirage tirage={monTirage} enCours={tirageEnCours} surTirer={tirerDes} />}
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
                <th>Bonus</th>
                <th>Total</th>
                <th>Mod.</th>
              </tr>
            </thead>
            <tbody>
              {CARACS.map((c) => (
                <tr key={c} className={classe?.caracteristiquesPrincipales.includes(c) ? "caracs__principale" : undefined}>
                  <th>{NOMS_CARACTERISTIQUES[c]}</th>
                  <td>
                    <ScoreDeBase carac={c} methode={methode} base={base} regles={regles} valeursTirage={valeursTirage} surChange={(v) => changerScore(c, v)} />
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
        </div>
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
      {animation && <AnimationTirage annonce={animation} surFin={() => setAnimation(null)} />}
    </form>
  );
}

/** Les choix d'options par defaut : le premier choix possible de chaque option. */
function optionsParDefaut(race: Race, idFaction: string, lore: boolean): Record<string, string> {
  return Object.fromEntries(race.options.map((o) => [o.id, (choixPossibles(o, idFaction, lore)[0] as ChoixOption | undefined)?.id ?? ""]));
}

/** Garde les choix encore possibles (changement de faction) ; remplace les autres par le premier possible. */
function ajusterOptions(race: Race, actuels: Record<string, string>, idFaction: string, lore: boolean): Record<string, string> {
  return Object.fromEntries(
    race.options.map((o) => {
      const possibles = choixPossibles(o, idFaction, lore) as ChoixOption[];
      return [o.id, possibles.some((c) => c.id === actuels[o.id]) ? actuels[o.id] : (possibles[0]?.id ?? "")];
    }),
  );
}

// --- Briques de l'ecran ---------------------------------------------------------------------

/** Image du dossier icones/ ; si elle manque, une pastille avec des initiales. */
/** Une image du dossier icones/ ; absente : l'image de secours (texture de WoW), sinon des initiales. */
function Image({ src, texte, classe, secours }: { src: string; texte: string; classe: string; secours?: string | null }) {
  const [absente, setAbsente] = useState(false);
  useEffect(() => setAbsente(false), [src]);
  if ((absente || !src) && secours) return <img className={classe} src={secours} alt="" />;
  if (absente || !src) return <span className={`${classe} image-absente`}>{texte.toUpperCase()}</span>;
  return <img className={classe} src={`${src}?remplacement=non`} alt="" onError={() => setAbsente(true)} />;
}

function BoutonChoix(props: { nom: string; icone: string; couleur?: string; actif: boolean; interdit?: boolean; onClick: () => void; aide: React.ReactNode; secours?: string | null }) {
  const { nom, icone, couleur, actif, interdit, onClick, aide, secours } = props;
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
      <Image src={urlIcone(icone)} texte={nom.slice(0, 2)} classe="choix__icone" secours={secours} />
      <span className="choix__nom">{nom}</span>
    </button>
  );
}

function BonusTexte(race: Race) {
  const fixes = Object.entries(race.bonusCaracteristiques)
    .filter(([, v]) => v)
    .map(([c, v]) => `${abreviation(c as Caracteristique)} ${signe(v as number)}`);
  if (race.bonusAuChoix) fixes.push(`${race.bonusAuChoix.bonus.map(signe).join(" / ")} au choix`);
  return fixes.join(", ");
}

function AideRace({ race }: { race: Race }) {
  return (
    <>
      <div className="infobulle__titre">{race.nom}</div>
      <div>{race.typeCreature}</div>
      <div className="infobulle__ligne--or">{race.description}</div>
    </>
  );
}

function AideClasse({ classe, horsLore }: { classe: Classe; horsLore: string | null }) {
  return (
    <>
      <div className="infobulle__titre" style={{ color: classe.couleur }}>
        {classe.nom}
      </div>
      {classe.heroique && <div className="infobulle__ligne--or">Classe heroique (niveau 3 et plus, ou accord du MJ)</div>}
      <div>
        De de vie : d{classe.deDeVie}
        {classe.classeDnd ? ` - ${classe.classeDnd}` : ""}
      </div>
      <div className="infobulle__ligne--or">{classe.description}</div>
      {horsLore && <div className="infobulle__ligne--rouge">{horsLore}</div>}
    </>
  );
}

/**
 * Bonus d'historique (D&D 2024) : +2 et +1 sur deux de ses trois
 * caracteristiques, ou +1 sur les trois.
 */
function ChoixRepartition(props: { historique: Historique; repartition: Partial<Record<Caracteristique, number>>; surChange: (r: Partial<Record<Caracteristique, number>>) => void }) {
  const { historique, repartition, surChange } = props;
  const trois = historique.caracteristiques;
  const egal = trois.every((c) => repartition[c] === 1);
  const plusDeux = trois.find((c) => repartition[c] === 2) ?? trois[0];
  const plusUn = trois.find((c) => repartition[c] === 1 && c !== plusDeux) ?? trois.find((c) => c !== plusDeux)!;
  return (
    <div className="creation__bonus-choix">
      <button type="button" className={`onglet${!egal ? " onglet--actif" : ""}`} onClick={() => surChange({ [plusDeux]: 2, [plusUn]: 1 })}>
        +2 / +1
      </button>
      <button type="button" className={`onglet${egal ? " onglet--actif" : ""}`} onClick={() => surChange(Object.fromEntries(trois.map((c) => [c, 1])))}>
        +1 / +1 / +1
      </button>
      {!egal && (
        <>
          <label>
            +2 :{" "}
            <select value={plusDeux} onChange={(e) => {
              const c = e.target.value as Caracteristique;
              surChange({ [c]: 2, [c === plusUn ? trois.find((x) => x !== c)! : plusUn]: 1 });
            }}>
              {trois.map((c) => (
                <option key={c} value={c}>
                  {NOMS_CARACTERISTIQUES[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            +1 :{" "}
            <select value={plusUn} onChange={(e) => surChange({ [plusDeux]: 2, [e.target.value]: 1 })}>
              {trois
                .filter((c) => c !== plusDeux)
                .map((c) => (
                  <option key={c} value={c}>
                    {NOMS_CARACTERISTIQUES[c]}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}

const NOMS_METHODES: Record<MethodeCaracteristiques, string> = {
  "tableau-standard": "Tableau standard",
  "achat-de-points": "Achat de points",
  "tirage-4d6": "Des (4d6)",
};

/** Le tirage aux des : le bouton, puis les scores obtenus (vus par toute la table). */
function PanneauTirage({ tirage, enCours, surTirer }: { tirage: TirageCreation | null; enCours: boolean; surTirer: () => void }) {
  const total = (v: number[]) => v.reduce((a, b) => a + b, 0);
  if (!tirage) {
    return (
      <div className="creation__tirage">
        <p>Six fois 4d6 : on garde les 3 meilleurs des. Toute la table verra ton resultat. Tu as 2 relances ; au-dela, il faut l'accord du MJ. Ton meilleur tirage est toujours garde.</p>
        <button type="button" className="bouton" disabled={enCours} onClick={surTirer}>
          Lancer les des
        </button>
      </div>
    );
  }
  const garde = tirage.tirages[tirage.retenu];
  const autres = tirage.tirages.filter((_, i) => i !== tirage.retenu);
  return (
    <div className="creation__tirage">
      <p>
        Ton tirage : <b>{[...garde].sort((a, b) => b - a).join(", ")}</b> (total {total(garde)}). Repartis ces valeurs ci-dessous.
      </p>
      {autres.length > 0 && (
        <p className="creation__tirage-ancien">
          {autres.length === 1 ? "Autre tirage (moins bon)" : "Autres tirages (moins bons)"} : {autres.map((v) => `${[...v].sort((a, b) => b - a).join(", ")} (total ${total(v)})`).join(" ; ")}
        </p>
      )}
      {tirage.relancesRestantes > 0 ? (
        <button type="button" className="bouton" disabled={enCours} onClick={surTirer}>
          Relancer ({tirage.relancesRestantes} restante{tirage.relancesRestantes > 1 ? "s" : ""} ; ton meilleur tirage est garde)
        </button>
      ) : (
        <p className="creation__tirage-ancien">Plus de relance. Pour en avoir une autre, demande au MJ.</p>
      )}
    </div>
  );
}

/** Le score de BASE d'une caracteristique : liste du tableau standard, ou boutons - / + (achat). */
function ScoreDeBase(props: {
  carac: Caracteristique;
  methode: MethodeCaracteristiques;
  base: Base;
  regles: Referentiel["creation"];
  valeursTirage: number[] | null;
  surChange: (v: number) => void;
}) {
  const { carac, methode, base, regles, valeursTirage, surChange } = props;
  const valeur = base[carac];
  if (methode === "tirage-4d6" && !valeursTirage) return <span className="caracs__attente">-</span>;
  if (methode !== "achat-de-points") {
    return (
      <select className="caracs__liste" value={valeur} onChange={(e) => surChange(Number(e.target.value))}>
        {[...(valeursARepartir(methode, regles, valeursTirage) as number[])]
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
