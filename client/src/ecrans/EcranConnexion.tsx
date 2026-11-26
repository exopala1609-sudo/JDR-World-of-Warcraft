import { useEffect, useState, type FormEvent } from "react";
import { jeu, useJeu } from "@/core/jeu";

/**
 * Ecran d'accueil : la porte UNIQUE du jeu (http://localhost:3000/).
 * Par defaut on entre en joueur : un pseudo et SON mot de passe (choisi a la
 * premiere connexion). Le Maitre du Jeu passe par un lien discret en bas.
 * Ensuite, tout le monde arrive sur la meme interface : seul le ROLE change.
 */
export function EcranConnexion() {
  const [role, setRole] = useState<"joueur" | "mj">("joueur");
  const [pseudo, setPseudo] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState(""); // code commun de la table (VTT_CODE_TABLE), si le serveur l'exige
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const avis = useJeu((e) => e.avis); // ex. "Le Maitre du Jeu t'a expulse de la table."
  // Le serveur exige-t-il un code de table pour les joueurs ?
  const [codeRequis, setCodeRequis] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((infos) => setCodeRequis(Boolean(infos?.codeTableRequis)))
      .catch(() => {});
  }, []);

  const entrer = async (e: FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur((await jeu.connecter(role, pseudo, motDePasse, code)) ?? "");
    setEnvoi(false);
  };

  return (
    <div className="ecran-accueil">
      {/* Le logo de WoW, si Glues-WoW-ClassicLogo est dans le dossier interface/ */}
      <div className="accueil__logo" aria-hidden="true" />
      <form className="accueil cadre" onSubmit={entrer}>
        <h1 className="titre-or accueil__titre">Donjons &amp; Dragons</h1>
        <p className="accueil__sous-titre">Table virtuelle</p>
        {role === "joueur" ? (
          <>
            <label>
              Pseudo
              <input className="champ" value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={24} autoComplete="username" autoFocus />
            </label>
            <label>
              Mot de passe
              <input
                className="champ"
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                maxLength={100}
                autoComplete="current-password"
              />
            </label>
            <p className="accueil__aide">Premiere fois ? Choisis ton mot de passe (6 caracteres minimum) : il te sera demande a chaque connexion.</p>
            {codeRequis && (
              <label>
                Code de la table
                <input className="champ" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
              </label>
            )}
          </>
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
            setMotDePasse(""); // le mot de passe du MJ ne doit pas rester dans le champ du joueur, ni l'inverse
            setErreur("");
          }}
        >
          {role === "joueur" ? "Connexion Maitre du Jeu" : "Retour a la connexion joueur"}
        </button>
      </form>
    </div>
  );
}
