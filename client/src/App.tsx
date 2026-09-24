import { useEffect } from "react";
import { EcranConnexion } from "@/ecrans/EcranConnexion";
import { EcranJeu } from "@/ecrans/EcranJeu";
import { EcranTables } from "@/ecrans/EcranTables";
import { jeu, useJeu } from "@/core/jeu";
import { SceneJeu } from "@/ui/SceneJeu";

let sessionReprise = false; // en developpement, React lance les effets deux fois

export default function App() {
  const profil = useJeu((e) => e.profil);
  const table = useJeu((e) => e.table);

  useEffect(() => {
    if (sessionReprise) return;
    sessionReprise = true;
    jeu.reprendreSession(); // apres un F5, on retrouve sa partie
  }, []);

  return <SceneJeu>{!profil ? <EcranConnexion /> : !table ? <EcranTables /> : <EcranJeu />}</SceneJeu>;
}
