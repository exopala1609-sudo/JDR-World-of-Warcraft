import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { jeu, useJeu } from "@/core/jeu";
import type { LigneJournal } from "@/core/types";
import { BoutonDes, LanceurDes } from "@/jeu/LanceurDes";

/** Le canal "colle" (comme dans WoW) : apres un /g, on reste en groupe jusqu'au prochain changement. */
type Canal = { canal: "dire" } | { canal: "groupe" } | { canal: "murmure"; vers: string };

const AIDE = [
  "Texte simple : parler (Dire). /s : Dire, /g : Groupe (hors jeu), /w Pseudo message : murmure (prive).",
  "/jet 1d20+5 Raison : lancer des des.",
];

/**
 * Le destinataire d'un "/w ..." : on essaie d'abord les pseudos CONNECTES
 * (certains contiennent des espaces : "Maitre du Jeu"), le plus long d'abord ;
 * sinon, le premier mot.
 */
function separerMurmure(reste: string, presents: string[]): { vers: string; texte: string } | null {
  const bas = reste.toLocaleLowerCase("fr");
  const candidat = [...presents, "MJ"]
    .sort((a, b) => b.length - a.length)
    .find((p) => bas.startsWith(p.toLocaleLowerCase("fr") + " "));
  if (candidat) return { vers: candidat, texte: reste.slice(candidat.length + 1).trim() };
  const [vers, ...mots] = reste.split(/\s+/);
  return vers ? { vers, texte: mots.join(" ") } : null;
}

/** Une ligne du journal, formatee comme dans WoW. Le [Nom] se clique pour murmurer. */
function Ligne({ ligne, surNom }: { ligne: LigneJournal; surNom: (pseudo: string) => void }) {
  const m = ligne.message;
  if (!m) return <div className={`discussion__ligne--${ligne.type}`}>{ligne.texte}</div>;
  const nom = (
    <button type="button" className="discussion__nom" onClick={() => surNom(m.pseudo)} title={`Murmurer a ${m.pseudo}`}>
      [{m.nom}]
    </button>
  );
  return (
    <div className={`discussion__ligne--${ligne.type}`} title={m.heure}>
      {ligne.type === "dire" && (
        <>
          {nom} dit : {ligne.texte}
        </>
      )}
      {ligne.type === "groupe" && (
        <>
          [Groupe] {nom} : {ligne.texte}
        </>
      )}
      {ligne.type === "murmure" &&
        (m.envoye ? (
          <>
            A {nom} : {ligne.texte}
          </>
        ) : (
          <>
            {nom} murmure : {ligne.texte}
          </>
        ))}
    </div>
  );
}

/**
 * Bas gauche : la fenetre de discussion, facon WoW. Elle affiche le journal de
 * la partie et les messages des joueurs, avec les couleurs de WoW :
 *   blanc  : Dire (le personnage parle)        /s, ou texte simple
 *   bleu   : Groupe (hors jeu, entre joueurs)  /g
 *   rose   : Murmure (prive, a UNE personne)   /w Pseudo message
 *   jaune  : des et annonces du systeme
 * Autres commandes :
 *   /jet 1d20+5 Attaque     (ou /r)   -> lance des des (ou le bouton "de")
 *   /quete Titre | Objectif            -> (MJ) donne une quete a tout le groupe
 */
export function Discussion() {
  const journal = useJeu((e) => e.journal);
  const presents = useJeu((e) => e.presence);
  const moi = useJeu((e) => e.profil?.pseudo ?? "");
  const [saisie, setSaisie] = useState("");
  const [canal, setCanal] = useState<Canal>({ canal: "dire" });
  const [lanceurOuvert, setLanceurOuvert] = useState(false);
  const fermerLanceur = useCallback(() => setLanceurOuvert(false), []);
  const refLignes = useRef<HTMLDivElement>(null);
  const refSaisie = useRef<HTMLInputElement>(null);

  // Toujours afficher la derniere ligne.
  useEffect(() => {
    refLignes.current?.scrollTo({ top: refLignes.current.scrollHeight });
  }, [journal]);

  /** Clic sur un [Nom] : on passe en murmure vers lui, curseur dans la saisie. */
  const murmurerA = (pseudo: string) => {
    if (pseudo.toLocaleLowerCase("fr") === moi.toLocaleLowerCase("fr")) return;
    setCanal({ canal: "murmure", vers: pseudo });
    refSaisie.current?.focus();
  };

  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    const texte = saisie.trim();
    setSaisie("");
    (document.activeElement as HTMLElement)?.blur(); // rend le clavier au jeu (touches B, C...)
    if (!texte) return;

    const commande = texte.match(/^\/(\S+)\s*(.*)$/s);
    if (!commande) return void parler(canal, texte);
    const [, nomCommande, reste] = commande;
    switch (nomCommande.toLocaleLowerCase("fr")) {
      case "s":
      case "dire":
        setCanal({ canal: "dire" });
        return void (reste && parler({ canal: "dire" }, reste));
      case "g":
      case "p":
      case "groupe":
        setCanal({ canal: "groupe" });
        return void (reste && parler({ canal: "groupe" }, reste));
      case "w":
      case "m":
      case "murmurer": {
        const murmure = separerMurmure(reste, presents.map((p) => p.pseudo));
        if (!murmure) return jeu.journaliser("Ecris : /w Pseudo message", "erreur");
        setCanal({ canal: "murmure", vers: murmure.vers });
        return void (murmure.texte && parler({ canal: "murmure", vers: murmure.vers }, murmure.texte));
      }
      case "jet":
      case "r": {
        const [formule, ...raison] = reste.split(/\s+/);
        if (!formule) return jeu.journaliser("Ecris : /jet 1d20+5 Raison", "erreur");
        return void jeu.lancerDes(formule, raison.join(" ") || undefined);
      }
      case "quete":
      case "quête": {
        // "/quete Le repaire des Defias | Eliminer Edwin VanCleef" : titre | objectif | description (facultative)
        const [titre = "", objectif = "", description] = reste.split("|").map((morceau) => morceau.trim());
        if (!titre || !objectif) return jeu.journaliser("Ecris : /quete Titre | Objectif (le | separe les deux).", "erreur");
        return void jeu.donnerQuete(titre, objectif, description);
      }
      case "aide":
      case "?":
        return AIDE.forEach((ligne) => jeu.journaliser(ligne));
      default:
        jeu.journaliser(`Commande inconnue : /${nomCommande}. Tape /aide pour la liste.`, "erreur");
    }
  };

  const parler = (c: Canal, texte: string) => jeu.envoyerMessage(c.canal, texte, c.canal === "murmure" ? c.vers : undefined);

  // Echap : on quitte la saisie sans envoyer (le clavier revient au jeu).
  const touche = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") e.currentTarget.blur();
  };

  const etiquette = canal.canal === "dire" ? "Dire :" : canal.canal === "groupe" ? "Groupe :" : `A ${canal.vers} :`;
  return (
    <div className="discussion">
      {lanceurOuvert && <LanceurDes surFermer={fermerLanceur} />}
      <div className="discussion__lignes" ref={refLignes}>
        {journal.map((ligne) => (
          <Ligne key={ligne.id} ligne={ligne} surNom={murmurerA} />
        ))}
      </div>
      <form className={`discussion__saisie discussion__saisie--${canal.canal}`} onSubmit={envoyer}>
        <label className="discussion__canal" htmlFor="saisie-discussion">
          {etiquette}
        </label>
        <input
          id="saisie-discussion"
          ref={refSaisie}
          className="champ"
          value={saisie}
          maxLength={500}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={touche}
          placeholder="Entree pour ecrire - /aide"
          autoComplete="off"
        />
        <BoutonDes ouvert={lanceurOuvert} surClic={() => setLanceurOuvert((o) => !o)} />
      </form>
    </div>
  );
}
