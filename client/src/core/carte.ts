// Point de rencontre entre la grande carte et la minicarte : la grande carte
// y depose son moteur et signale chaque changement ; la minicarte s'y abonne.
import type { MoteurCarte } from "@partage/moteur-carte.js";

const ecouteurs = new Set<() => void>();

export const carte = {
  moteur: null as MoteurCarte | null,
  signalerChangement() {
    ecouteurs.forEach((rappel) => rappel());
  },
  surChangement(rappel: () => void) {
    ecouteurs.add(rappel);
    return () => {
      ecouteurs.delete(rappel);
    };
  },
};
