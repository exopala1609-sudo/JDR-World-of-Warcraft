// Silhouette SVG de chaque de (d4 triangle, d6 carre, d8 losange...), dans un
// carre de 100 x 100. Servent au lanceur de des ET a la fenetre de resolution.
export const FACES = [4, 6, 8, 10, 12, 20, 100] as const;
export type Faces = (typeof FACES)[number];

export const FORMES: Record<Faces, string> = {
  4: "50,8 93,88 7,88",
  6: "15,15 85,15 85,85 15,85",
  8: "50,4 94,50 50,96 6,50",
  10: "50,4 93,40 50,96 7,40",
  12: "50,4 95,36 78,93 22,93 5,36",
  20: "50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5",
  100: "50,4 83,17 96,50 83,83 50,96 17,83 4,50 17,17",
};

/** Le de connu le plus proche (un "d3" s'affiche comme un d4). */
export const formeProche = (faces: number): Faces => FACES.find((f) => f >= faces) ?? 100;
