import { useJeu } from "@/core/jeu";

/** Haut centre : le tour de combat en cours (ou rien hors combat). */
export function Bandeau() {
  const combat = useJeu((e) => e.combat);
  const liaison = useJeu((e) => e.liaison);
  if (liaison === "reconnexion") return <div className="bandeau cadre titre-or">Connexion perdue - reconnexion...</div>;
  if (!combat) return null;
  const actif = combat.participants[combat.indexActif];
  return (
    <div className="bandeau cadre titre-or">
      Round {combat.round} - au tour de {actif?.nom}
    </div>
  );
}
