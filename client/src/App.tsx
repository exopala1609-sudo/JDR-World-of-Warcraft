import { useEffect } from "react";
import { EcranConnexion } from "@/ecrans/EcranConnexion";
import { EcranCreation } from "@/ecrans/EcranCreation";
import { EcranJeu } from "@/ecrans/EcranJeu";
import { EcranTables } from "@/ecrans/EcranTables";
import { jeu, useJeu } from "@/core/jeu";
import { SceneJeu } from "@/ui/SceneJeu";

let sessionReprise = false; // en developpement, React lance les effets deux fois

export default function App() {
  const profil = useJeu((e) => e.profil);
  const table = useJeu((e) => e.table);
  const creationRequise = useJeu((e) => e.creationRequise);

  useEffect(() => {
    if (sessionReprise) return;
    sessionReprise = true;
    jeu.reprendreSession(); // apres un F5, on retrouve sa partie
  }, []);

  // Le parcours, pilote par l'etat recu du serveur :
  //   connexion -> choix de la table -> [creation du personnage] -> jeu
  const ecran = !profil ? <EcranConnexion /> : !table ? <EcranTables /> : creationRequise ? <EcranCreation /> : <EcranJeu />;
  return <SceneJeu>{ecran}</SceneJeu>;
}
