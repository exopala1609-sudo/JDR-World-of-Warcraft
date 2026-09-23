import { useEffect, useState, type CSSProperties } from "react";
import { SceneJeu } from "@/ui/SceneJeu";
import { CadreOr } from "@/ui/CadreOr";
import { socket } from "@/core/socket";
import { EVENEMENTS, ROLES } from "@/core/protocole";
import { useEchelleInterface } from "@/core/useEchelleInterface";

type Participant = { id: string; nom: string; role: string };

export default function App() {
  const [connecte, setConnecte] = useState(socket.connected);
  const [nomDeLaPartie, setNomDeLaPartie] = useState("...");
  const [connectes, setConnectes] = useState<Participant[]>([]);
  const { echelle, largeur, hauteur } = useEchelleInterface();

  useEffect(() => {
    const auBranchement = () => {
      setConnecte(true);
      // Etape 1 : tout le monde entre comme joueur anonyme.
      // L'ecran du MJ et l'authentification arriveront a l'etape suivante.
      socket.emit(EVENEMENTS.REJOINDRE, { role: ROLES.JOUEUR, nom: "Aventurier" });
    };
    const auDebranchement = () => setConnecte(false);
    const surEtat = (etat: { nomDeLaPartie: string; connectes: Participant[] }) => {
      setNomDeLaPartie(etat.nomDeLaPartie);
      setConnectes(etat.connectes);
    };

    socket.on("connect", auBranchement);
    socket.on("disconnect", auDebranchement);
    socket.on(EVENEMENTS.ETAT_SESSION, surEtat);
    if (socket.connected) auBranchement();

    return () => {
      socket.off("connect", auBranchement);
      socket.off("disconnect", auDebranchement);
      socket.off(EVENEMENTS.ETAT_SESSION, surEtat);
    };
  }, []);

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
        titre={nomDeLaPartie}
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
          Socle technique en place. L&apos;interface de jeu viendra se poser ici.
        </p>

        <Ligne
          etiquette="Liaison temps reel"
          valeur={connecte ? "etablie" : "en attente du serveur..."}
          couleur={connecte ? "var(--rarete-peu-commun)" : "var(--ressource-rage)"}
        />
        <Ligne etiquette="Surface de jeu" valeur={`${largeur} x ${hauteur}`} />
        <Ligne etiquette="Echelle de l'interface" valeur={`${Math.round(echelle * 100)} %`} />
        <Ligne
          etiquette="Connectes"
          valeur={connectes.length ? connectes.map((p) => p.nom).join(", ") : "aucun"}
        />
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
