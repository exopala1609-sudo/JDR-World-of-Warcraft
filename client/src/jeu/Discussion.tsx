import { useEffect, useRef, useState, type FormEvent } from "react";
import { EVENEMENTS } from "@partage/protocole.js";
import { jeu, useJeu } from "@/core/jeu";

/**
 * Bas gauche : la fenetre de discussion, facon WoW. Elle affiche le journal
 * de la partie (des, degats, butin...) et accepte des commandes :
 *   /jet 1d20+5 Attaque     (ou /r)   -> lance des des
 */
export function Discussion() {
  const journal = useJeu((e) => e.journal);
  const [saisie, setSaisie] = useState("");
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
    if (commande) {
      jeu.demander(EVENEMENTS.DES_LANCER, { formule: commande[2], ...(commande[3] ? { raison: commande[3] } : {}) });
    } else {
      jeu.journaliser('Commande inconnue. Essaie : /jet 1d20+5 Attaque', "erreur");
    }
  };

  return (
    <div className="discussion">
      <div className="discussion__lignes" ref={refLignes}>
        {journal.map((ligne) => (
          <div key={ligne.id} className={`discussion__ligne--${ligne.type}`}>
            {ligne.texte}
          </div>
        ))}
      </div>
      <form onSubmit={envoyer}>
        <input
          id="saisie-discussion"
          className="champ"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Entree pour ecrire - /jet 1d20+5"
          autoComplete="off"
        />
      </form>
    </div>
  );
}
