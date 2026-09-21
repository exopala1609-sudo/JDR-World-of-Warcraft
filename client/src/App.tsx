import { useEffect, useState } from "react";
import { Scene1440p } from "@/ui/Scene1440p";
import { CadreOr } from "@/ui/CadreOr";
import { socket } from "@/core/socket";
import { EVENEMENTS, ROLES } from "@/core/protocole";
import { useEchelle1440p } from "@/core/useEchelle1440p";

type Participant = { id: string; nom: string; role: string };

export default function App() {
  const [connecte, setConnecte] = useState(socket.connected);
  const [nomDeLaPartie, setNomDeLaPartie] = useState("...");
  const [connectes, setConnectes] = useState<Participant[]>([]);
  const { echelle } = useEchelle1440p();

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
    <Scene1440p>
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
        <Ligne etiquette="Resolution de travail" valeur="2560 x 1440 (paysage verrouille)" />
        <Ligne etiquette="Zoom applique" valeur={`${(echelle * 100).toFixed(0)} %`} />
        <Ligne
          etiquette="Connectes"
          valeur={connectes.length ? connectes.map((p) => p.nom).join(", ") : "aucun"}
        />
      </CadreOr>
    </Scene1440p>
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
