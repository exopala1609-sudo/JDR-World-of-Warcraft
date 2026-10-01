import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { jeu, useJeu } from "@/core/jeu";
import { BoutonDes, LanceurDes } from "@/jeu/LanceurDes";

/**
 * Bas gauche : la fenetre de discussion, facon WoW. Elle affiche le journal
 * de la partie (des, degats, butin...) et accepte des commandes :
 *   /jet 1d20+5 Attaque     (ou /r)   -> lance des des (ou le bouton "de" : lanceur de des)
 *   /quete Titre | Objectif            -> (MJ) donne une quete a tout le groupe
 */
export function Discussion() {
  const journal = useJeu((e) => e.journal);
  const [saisie, setSaisie] = useState("");
  const [lanceurOuvert, setLanceurOuvert] = useState(false);
  const fermerLanceur = useCallback(() => setLanceurOuvert(false), []);
  const refLignes = useRef<HTMLDivElement>(null);

  // Toujours afficher la derniere ligne.
  useEffect(() => {
    refLignes.current?.scrollTo({ top: refLignes.current.scrollHeight });
  }, [journal]);

  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    const texte = saisie.trim();
    setSaisie("");
    (document.activeElement as HTMLElement)?.blur(); // rend le clavier au jeu (touches B, C...)
    if (!texte) return;
    const commande = texte.match(/^\/(jet|r)\s+(\S+)\s*(.*)$/i);
    const quete = texte.match(/^\/qu[eê]te\s+(.*)$/i);
    if (commande) {
      jeu.lancerDes(commande[2], commande[3] || undefined);
    } else if (quete) {
      // "/quete Le repaire des Defias | Eliminer Edwin VanCleef" : titre | objectif | description (facultative)
      const [titre = "", objectif = "", description] = quete[1].split("|").map((morceau) => morceau.trim());
      if (!titre || !objectif) jeu.journaliser("Ecris : /quete Titre | Objectif (le | separe les deux).", "erreur");
      else jeu.donnerQuete(titre, objectif, description);
    } else {
      jeu.journaliser(`Commande inconnue. Essaie : /jet 1d20+5 Attaque${jeu.estMJ() ? " ou /quete Titre | Objectif" : ""}`, "erreur");
    }
  };

  return (
    <div className="discussion">
      {lanceurOuvert && <LanceurDes surFermer={fermerLanceur} />}
      <div className="discussion__lignes" ref={refLignes}>
        {journal.map((ligne) => (
          <div key={ligne.id} className={`discussion__ligne--${ligne.type}`}>
            {ligne.texte}
          </div>
        ))}
      </div>
      <form className="discussion__saisie" onSubmit={envoyer}>
        <input
          id="saisie-discussion"
          className="champ"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Entree pour ecrire - /jet 1d20+5"
          autoComplete="off"
        />
        <BoutonDes ouvert={lanceurOuvert} surClic={() => setLanceurOuvert((o) => !o)} />
      </form>
    </div>
  );
}
