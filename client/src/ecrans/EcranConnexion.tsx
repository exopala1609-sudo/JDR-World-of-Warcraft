import { useState, type FormEvent } from "react";
import { jeu, useJeu } from "@/core/jeu";

/** Ecran d'accueil : joueur (pseudo) ou Maitre du Jeu (mot de passe). */
export function EcranConnexion() {
  const [role, setRole] = useState<"joueur" | "mj">("joueur");
  const [pseudo, setPseudo] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const avis = useJeu((e) => e.avis); // ex. "Le Maitre du Jeu t'a expulse de la table."

  const entrer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur((await jeu.connecter(role, pseudo, motDePasse)) ?? "");
    setEnvoi(false);
  };

  return (
    <div className="ecran-accueil">
      <form className="accueil cadre" onSubmit={entrer}>
        <h1 className="titre-or accueil__titre">Donjons &amp; Dragons</h1>
        <p className="accueil__sous-titre">Table virtuelle</p>
        <div className="accueil__roles">
          {(["joueur", "mj"] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`accueil__role${role === r ? " accueil__role--actif" : ""}`}
              onClick={() => setRole(r)}
            >
              {r === "joueur" ? "Joueur" : "Maitre du Jeu"}
            </button>
          ))}
        </div>
        {role === "joueur" ? (
          <label>
            Pseudo
            <input className="champ" value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={24} autoFocus />
          </label>
        ) : (
          <label>
            Mot de passe
            <input className="champ" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoFocus />
          </label>
        )}
        <div className="accueil__erreur">{erreur || avis}</div>
        <button className="bouton" type="submit" disabled={envoi}>
          Entrer dans le monde
        </button>
      </form>
    </div>
  );
}
