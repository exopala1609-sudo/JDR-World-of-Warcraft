// Adresses des images servies depuis ton dossier (carre gris si absentes).

/** "Jaina Portvaillant" -> "jaina-portvaillant" : le nom de fichier attendu. */
export function nomDeFichier(texte: string) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Icone d'un objet, d'un sort ou d'un etat : icones/<nom>.png (ou .jpg, .webp...). */
export const urlIcone = (nom: string) => `/medias/icones/${encodeURIComponent(nom)}`;

/** Portrait d'un personnage : portraits/<nom-du-personnage>.png */
export const urlPortrait = (nom: string) => `/medias/portraits/${encodeURIComponent(nomDeFichier(nom))}`;

/** Icone d'un objet : son champ "icone", sinon son entree du compendium, sinon son nom. */
export const iconeObjet = (objet: { icone?: string; source?: string | null; nom: string }) =>
  urlIcone(objet.icone ?? objet.source ?? nomDeFichier(objet.nom));
