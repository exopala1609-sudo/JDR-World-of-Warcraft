import type { CSSProperties } from "react";

/** Barre de vie ou de ressource : la largeur suit la valeur, avec une transition. */
export function Barre({
  actuel,
  max,
  couleur,
  classe = "",
  texte,
}: {
  actuel: number;
  max: number;
  couleur?: string;
  classe?: string;
  texte?: string;
}) {
  const pourcentage = max > 0 ? Math.max(0, Math.min(100, (actuel / max) * 100)) : 0;
  const style = couleur ? ({ "--couleur-barre": couleur } as CSSProperties) : undefined;
  return (
    <div className={`barre ${classe}`} style={style}>
      <div className="barre__remplissage" style={{ width: `${pourcentage}%` }} />
      <div className="barre__texte">{texte ?? `${actuel} / ${max}`}</div>
    </div>
  );
}
