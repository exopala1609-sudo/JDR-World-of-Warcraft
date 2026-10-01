import { useState, type FormEvent } from "react";
import { jeu, useJeu } from "@/core/jeu";

/**
 * Ecran d'accueil : la porte UNIQUE du jeu (http://localhost:3000/).
 * Par defaut on entre en joueur (un pseudo). Le Maitre du Jeu passe par un
 * lien discret en bas, qui remplace le pseudo par un mot de passe. Ensuite,
 * tout le monde arrive sur la meme interface : seul le ROLE change.
 */
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
        {role === "joueur" ? (
          <label>
            Pseudo
            <input className="champ" value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={24} autoFocus />
          </label>
        ) : (
          <label>
            Mot de passe du Maitre du Jeu
            <input
              className="champ"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </label>
        )}
        <div className="accueil__erreur">{erreur || avis}</div>
        <button className="bouton" type="submit" disabled={envoi}>
          Entrer dans le monde
        </button>
        <button
          type="button"
          className="accueil__lien-mj"
          onClick={() => {
            setRole(role === "joueur" ? "mj" : "joueur");
            setErreur("");
          }}
        >
          {role === "joueur" ? "Connexion Maitre du Jeu" : "Retour a la connexion joueur"}
        </button>
      </form>
    </div>
  );
}
