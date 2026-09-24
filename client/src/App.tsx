import type { CSSProperties } from "react";
import { SceneJeu } from "@/ui/SceneJeu";
import { CadreOr } from "@/ui/CadreOr";
import { useEchelleInterface } from "@/core/useEchelleInterface";

// Sprint 1 (infrastructure) : l'interface graphique est en pause. Le banc de
// test brut se trouve sur /test/ ; cet ecran ne fait que reserver la place.
export default function App() {
  const { echelle, largeur, hauteur } = useEchelleInterface();

  return (
    <SceneJeu>
      {/* Emplacements prevus par le cahier des charges, accroches aux bords. */}
      <ZoneReservee nom="Portraits du groupe" style={{ top: 24, left: 24, width: 360, height: 440 }} />
      <ZoneReservee nom="Minicarte" style={{ top: 24, right: 24, width: 280, height: 280 }} />
      <ZoneReservee
        nom="Barres d'action"
        style={{ bottom: 24, left: "50%", transform: "translateX(-50%)", width: 1040, height: 136 }}
      />

      <CadreOr
        titre="Interface en pause"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 760,
          textAlign: "center",
        }}
      >
        <p style={{ margin: "0 0 20px", fontSize: 20, opacity: 0.85 }}>
          Sprint 1 : infrastructure. Le banc de test se trouve sur <a href="/test/">/test/</a>.
        </p>
        <Ligne etiquette="Surface de jeu" valeur={`${largeur} x ${hauteur}`} />
        <Ligne etiquette="Echelle de l'interface" valeur={`${Math.round(echelle * 100)} %`} />
      </CadreOr>
    </SceneJeu>
  );
}

function Ligne({
  etiquette,
  valeur,
  couleur = "var(--wow-parchemin)",
}: {
  etiquette: string;
  valeur: string;
  couleur?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 4px",
        borderTop: "1px solid rgba(212,175,55,0.22)",
        fontSize: 18,
      }}
    >
      <span style={{ opacity: 0.7 }}>{etiquette}</span>
      <strong style={{ color: couleur, fontFamily: "var(--police-chiffres)" }}>{valeur}</strong>
    </div>
  );
}

function ZoneReservee({ nom, style }: { nom: string; style: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        display: "grid",
        placeItems: "center",
        border: "2px dashed rgba(212,175,55,0.35)",
        borderRadius: 6,
        color: "rgba(232,217,181,0.45)",
        fontSize: 18,
        letterSpacing: 1,
        ...style,
      }}
    >
      {nom}
    </div>
  );
}
