import { useTexture } from "@/core/textures";
import { useEffect, useState } from "react";
import { EVENEMENTS } from "@partage/protocole.js";
import { audio, useAudio } from "@/core/audio";
import { jeu, useJeu } from "@/core/jeu";
import { avecInfobulle } from "@/ui/InfoBulle";

// Les sons que le jeu joue tout seul (voir sons/LISEZ-MOI.txt dans le cloud).
const SONS_DU_JEU = ["murmure", "quete-nouvelle", "quete-terminee", "combat"];

/**
 * Le bouton haut-parleur du micro-menu : volume, silence, et (MJ) la
 * "soundboard" pour faire entendre un son a toute la table.
 * Tant que le navigateur n'a pas autorise le son (aucun clic depuis le
 * chargement de la page), le bouton clignote.
 */
export function ReglageSon() {
  const { pret, volume, muet } = useAudio();
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const [ouvert, setOuvert] = useState(false);
  const [fichiers, setFichiers] = useState<string[]>([]);

  // Le MJ : les sons de son dossier sons/ (sans l'extension), en plus de ceux du jeu.
  useEffect(() => {
    if (!ouvert || !estMJ) return;
    jeu.demander(EVENEMENTS.MEDIAS_LISTER, { categorie: "sons" }).then((r) => {
      if (r.ok) setFichiers((r.fichiers as string[]).map((f) => f.replace(/\.[^.]+$/, "")));
    });
  }, [ouvert, estMJ]);
  const sons = [...new Set([...SONS_DU_JEU, ...fichiers])];

  const icone = !pret ? "?" : muet || volume === 0 ? "x" : volume < 0.4 ? ")" : "))";
  const hautParleur = useTexture("icone-son"); // VOICECHAT-SPEAKER, s'il est dans interface/
  return (
    <div className="reglage-son">
      <button
        type="button"
        className={`menu__bouton reglage-son__bouton${pret ? "" : " reglage-son__bouton--bloque"}${ouvert ? " menu__bouton--actif" : ""}`}
        onClick={() => setOuvert((o) => !o)}
        aria-label="Son"
        {...avecInfobulle(() => (
          <>
            <div className="infobulle__titre">Son</div>
            {pret ? (
              <div className="infobulle__ligne--gris">{muet ? "Coupe." : `Volume : ${Math.round(volume * 100)} %`}</div>
            ) : (
              <div className="infobulle__ligne--or">Le navigateur bloque le son tant que tu n'as pas clique dans la page. Clique n'importe ou.</div>
            )}
          </>
        ))}
      >
        {hautParleur ? (
          <img src={hautParleur} alt="" className={`reglage-son__image${icone === "x" ? " reglage-son__image--muet" : ""}`} />
        ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="reglage-son__icone">
          <path d="M3 9h4l5-4v14l-5-4H3z" />
          {icone === "x" && <path d="M16 9l5 6M21 9l-5 6" className="reglage-son__trait" />}
          {(icone === ")" || icone === "))") && <path d="M15 9.5a3.5 3.5 0 0 1 0 5" className="reglage-son__trait" />}
          {icone === "))" && <path d="M17.5 7a7 7 0 0 1 0 10" className="reglage-son__trait" />}
        </svg>
        )}
      </button>
      {ouvert && (
        <div className="reglage-son__panneau cadre">
          <h3 className="titre-or reglage-son__titre">Son</h3>
          <label className="reglage-son__ligne">
            Volume
            <input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={(e) => audio.regler(Number(e.target.value) / 100)} />
          </label>
          <div className="reglage-son__ligne">
            <button type="button" className="bouton bouton--discret" onClick={() => audio.basculerMuet()}>
              {muet ? "Remettre le son" : "Couper le son"}
            </button>
            <button type="button" className="bouton bouton--discret" onClick={() => audio.jouer("murmure")}>
              Tester
            </button>
          </div>
          {estMJ && (
            <>
              <h3 className="titre-or reglage-son__titre">Faire entendre a la table</h3>
              <div className="reglage-son__sons">
                {sons.map((son) => (
                  <button key={son} type="button" className="reglage-son__son" onClick={() => jeu.demander(EVENEMENTS.SON_DIFFUSER, { son })}>
                    {son}
                  </button>
                ))}
              </div>
              <p className="reglage-son__astuce">Ajoute tes sons dans le dossier sons/ de ton cloud.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
